const { GoogleGenAI } = require('@google/genai');
const { submitPriorityAnalysisTool, buildSystemInstruction, toolConfig } = require('./cacheService');

const HAS_API_KEY = !!process.env.GEMINI_API_KEY;
const ai = HAS_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const MODEL = 'gemini-2.5-flash';

// Heuristic fallback used when the Gemini API key is missing or every retry
// fails (e.g. 429 / quota). Keeps the demo functional offline by deriving a
// reasonable priority score and resource plan from the raw request fields.
function buildOfflineAnalysis(requestData, ragContext) {
    const urgency = String(requestData.urgency || '').toLowerCase();
    const peopleCount = Number(requestData.peopleCount) || 1;
    const type = String(requestData.type || '').toLowerCase();

    const urgencyBase = { low: 38, medium: 58, high: 74, critical: 88 }[urgency] ?? 55;
    const peopleBoost = peopleCount >= 200 ? 10 : peopleCount >= 50 ? 6 : peopleCount >= 10 ? 3 : 0;
    const typeBoost = (type.includes('medical') || type.includes('rescue')) ? 4 : 0;
    const score = Math.min(99, urgencyBase + peopleBoost + typeBoost);

    const ceil = (n) => Math.max(1, Math.ceil(n));
    const resourceMap = {
        food: [
            { resourceType: 'food', quantity: ceil(peopleCount * 2), reasoning: 'Two-day ration per person.' },
            { resourceType: 'water', quantity: ceil(peopleCount * 3), reasoning: '3 liters per person per day.' }
        ],
        medical: [
            { resourceType: 'medical', quantity: ceil(peopleCount / 3), reasoning: 'Triage kits scaled to caseload.' },
            { resourceType: 'transport', quantity: ceil(peopleCount / 25), reasoning: 'Ambulance/transport for casualty evacuation.' }
        ],
        shelter: [
            { resourceType: 'shelter', quantity: ceil(peopleCount / 4), reasoning: '4 persons per tent.' },
            { resourceType: 'clothing', quantity: ceil(peopleCount), reasoning: 'One clothing set per person.' }
        ],
        water: [
            { resourceType: 'water', quantity: ceil(peopleCount * 3), reasoning: 'Hydration ration over 24h.' },
            { resourceType: 'sanitation', quantity: ceil(peopleCount / 10), reasoning: 'Hygiene kits scaled to group size.' }
        ],
        rescue: [
            { resourceType: 'rescue', quantity: ceil(peopleCount / 10), reasoning: 'Rescue squads scaled to affected count.' },
            { resourceType: 'medical', quantity: ceil(peopleCount / 4), reasoning: 'On-scene triage capacity.' }
        ],
        transport: [
            { resourceType: 'transport', quantity: ceil(peopleCount / 15), reasoning: 'Buses/vans (~15 capacity each).' }
        ],
        clothing: [
            { resourceType: 'clothing', quantity: ceil(peopleCount), reasoning: 'One set per person.' }
        ],
        sanitation: [
            { resourceType: 'sanitation', quantity: ceil(peopleCount / 10), reasoning: 'Hygiene kits scaled to group size.' }
        ]
    };
    const recommendedResources = resourceMap[type] || [
        { resourceType: 'food', quantity: ceil(peopleCount * 2), reasoning: 'Generic ration default.' },
        { resourceType: 'water', quantity: ceil(peopleCount * 3), reasoning: 'Generic hydration default.' }
    ];

    const ragPrecedent = ragContext
        ? `Heuristic precedent applied: ${ragContext.split('\n')[0]}`
        : 'Verified against memory: No applicable historical precedent required.';

    return {
        score,
        baseReasoning: `Heuristic priority for ${type || 'request'} affecting ${peopleCount} people at ${requestData.location || 'unknown location'} with urgency=${urgency || 'unspecified'}. AI analysis offline — score derived from urgency band, group size, and request type.`,
        predictiveForecast: 'Live AI forecast unavailable (offline mode). Monitor weather feed and reassess in 6-12h. Escalate if conditions deteriorate.',
        imageVerification: requestData.imageBase64 ? 'Image attached but vision verification unavailable in offline mode.' : 'No visual data submitted for AI verification.',
        detectedLanguage: 'English',
        ragPrecedent,
        recommendedResources,
        offlineMode: true
    };
}

// Static prefix — assembled once, reused every call so Gemini 2.5 implicit
// caching keys on it. Kept at module scope, not inlined in the function.
const SYSTEM_INSTRUCTION = buildSystemInstruction();
const TOOLS = [{ functionDeclarations: [submitPriorityAnalysisTool] }];

function parseRetryDelayMs(err) {
    // Gemini 429 carries google.rpc.RetryInfo with retryDelay like "2s"
    try {
        const payload = typeof err.message === 'string' ? JSON.parse(err.message) : err;
        const details = payload?.error?.details || [];
        const retryInfo = details.find(d => d['@type']?.includes('RetryInfo'));
        if (retryInfo?.retryDelay) {
            const match = retryInfo.retryDelay.match(/^(\d+(?:\.\d+)?)s$/);
            if (match) return Math.ceil(parseFloat(match[1]) * 1000);
        }
    } catch (_) { /* ignore parse errors */ }
    return null;
}

async function generateWithRetry(params, maxRetries = 3) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await ai.models.generateContent(params);
        } catch (err) {
            lastError = err;
            const retriable = err.status === 429 || err.status === 503;
            if (!retriable || attempt === maxRetries) throw err;
            const serverDelay = parseRetryDelayMs(err);
            const expBackoff = Math.min(1500 * Math.pow(2, attempt), 15000);
            const backoff = serverDelay ? Math.min(serverDelay + 500, 15000) : expBackoff;
            console.warn(`[RETRY] Gemini ${err.status} — waiting ${backoff}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, backoff));
        }
    }
    throw lastError;
}

async function analyzeRequestPrioritiy(requestData, liveWeatherContext, ragContext, liveIntelContext) {
    if (!HAS_API_KEY) {
        console.warn('[OFFLINE] GEMINI_API_KEY not set — using heuristic offline analysis.');
        return buildOfflineAnalysis(requestData, ragContext);
    }

    const prompt = `REQUEST DETAILS:
Type: ${requestData.type}
Number of People: ${requestData.peopleCount}
Urgency: ${requestData.urgency}
Location: ${requestData.location}
Notes: ${requestData.notes}

LIVE ENVIRONMENT CONTEXT (Open-Meteo):
${liveWeatherContext}

ORGANIZATIONAL RAG MEMORY (Gemini Embeddings — single best semantic match):
${ragContext ? ragContext : 'No semantic similarity found in historical archives. Rely on playbook and raw prediction.'}

LIVE WEB INTEL (Gemini + Google Search grounding):
${liveIntelContext ? liveIntelContext : 'No live web intel available (feature gated — enable via ENABLE_GROUNDING env var when billing is active). Rely on weather, playbook, and RAG memory only.'}

Call submit_priority_analysis now with your full decision.`;

    try {
        const parts = [{ text: prompt }];

        if (requestData.imageBase64) {
            const matches = requestData.imageBase64.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                parts.push({
                    inlineData: {
                        mimeType: matches[1],
                        data: matches[2]
                    }
                });
            }
        }

        const response = await generateWithRetry({
            model: MODEL,
            contents: [{ role: 'user', parts }],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                tools: TOOLS,
                toolConfig
            }
        });

        const functionCalls = response.functionCalls || [];
        if (functionCalls.length === 0) {
            throw new Error('Gemini did not emit a function call despite mode=ANY');
        }

        const args = functionCalls[0].args || {};
        const usage = response.usageMetadata;
        if (usage) {
            const cached = usage.cachedContentTokenCount ?? 0;
            const total = usage.promptTokenCount ?? 0;
            const pct = total > 0 ? Math.round((cached / total) * 100) : 0;
            console.log(`[TOKENS] prompt=${total} cached=${cached} (${pct}% implicit hit) output=${usage.candidatesTokenCount ?? 0}`);
        }
        console.log('[FUNCTION CALL] submit_priority_analysis args:', JSON.stringify(args, null, 2));

        return {
            score: args.score ?? 50,
            baseReasoning: args.baseReasoning || 'Failed to determine base reasoning.',
            predictiveForecast: args.predictiveForecast || 'Failed to generate temporal forecast.',
            imageVerification: args.imageVerification || 'No visual data processed.',
            detectedLanguage: args.detectedLanguage || 'English',
            ragPrecedent: args.ragPrecedent || 'No historical precedent verified.',
            recommendedResources: Array.isArray(args.recommendedResources) ? args.recommendedResources : []
        };
    } catch (error) {
        console.error('Gemini API Error — falling back to heuristic offline analysis:', error?.message || error);
        return buildOfflineAnalysis(requestData, ragContext);
    }
}

module.exports = {
    analyzeRequestPrioritiy
};
