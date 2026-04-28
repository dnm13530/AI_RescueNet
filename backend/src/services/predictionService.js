const { GoogleGenAI, Type } = require('@google/genai');
const { historicalDisasters } = require('../models/historyDb');

const HAS_API_KEY = !!process.env.GEMINI_API_KEY;
const ai = HAS_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const MODEL = 'gemini-2.5-flash';

function buildOfflinePrePositioningPlan({ region, threat, horizonHours }) {
    const horizon = Number(horizonHours) || 48;
    const baseRegion = String(region || 'target region').trim();
    const stagingPlan = [
        {
            district: `${baseRegion} — coastal/low-elevation zone`,
            priority: 'Critical',
            confidence: 72,
            readinessByHour: Math.max(36, horizon + 12),
            rationale: 'Coastal/low-elevation pockets typically take first impact and lose road access earliest. Stage before access window closes.',
            resources: [
                { resourceType: 'shelter', quantity: 60, reasoning: 'Capacity for ~240 displaced persons (4/tent).' },
                { resourceType: 'water', quantity: 600, reasoning: '3L/person/day for 48h shelter cohort.' },
                { resourceType: 'medical', quantity: 25, reasoning: 'Triage kits for storm-related injuries.' }
            ]
        },
        {
            district: `${baseRegion} — central/transit hub`,
            priority: 'High',
            confidence: 65,
            readinessByHour: Math.max(24, horizon),
            rationale: 'Central hub serves as redistribution point once outer roads become impassable.',
            resources: [
                { resourceType: 'transport', quantity: 8, reasoning: 'Buses to relay supplies inward when outer routes degrade.' },
                { resourceType: 'food', quantity: 400, reasoning: 'Two-day ration buffer for 200 affected.' },
                { resourceType: 'rescue', quantity: 6, reasoning: 'Squads available for forced-evacuation calls.' }
            ]
        },
        {
            district: `${baseRegion} — inland reception zone`,
            priority: 'Medium',
            confidence: 58,
            readinessByHour: Math.max(12, Math.floor(horizon / 2)),
            rationale: 'Inland reception zone receives evacuees after coastal staging fills; pre-position lighter loads.',
            resources: [
                { resourceType: 'sanitation', quantity: 30, reasoning: 'Hygiene kits for camp-style reception.' },
                { resourceType: 'clothing', quantity: 200, reasoning: 'Replacement sets for evacuees arriving wet.' }
            ]
        }
    ];

    return {
        threatAssessment: `Heuristic offline assessment for ${baseRegion}. Incoming threat: ${threat || 'unspecified'}. Horizon to peak: ${horizon}h. AI strategic planner offline — plan derived from generic vulnerability heuristics, not live forecast.`,
        overallConfidence: 60,
        stagingPlan,
        keyRisks: [
            'Without staged shelter at the coast, displaced families may have to walk inland once roads close.',
            'Medical triage at the impact zone may exceed local capacity if not pre-positioned.',
            'Transport bottlenecks at the central hub will compound delivery delays after impact.'
        ],
        ragPrecedent: 'No applicable historical precedent (offline mode — RAG embeddings unavailable).',
        offlineMode: true
    };
}

const RESOURCE_TYPES = ['food', 'medical', 'shelter', 'water', 'rescue', 'transport', 'clothing', 'sanitation'];

const submitPrePositioningPlanTool = {
    name: 'submit_prepositioning_plan',
    description: 'Submit a pre-positioning plan for an incoming disaster threat. You MUST call this function. Populate every field, choose 2-5 target districts that will likely be worst-hit, and justify each staging decision with a historical precedent when available.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            threatAssessment: {
                type: Type.STRING,
                description: 'One-paragraph situational summary of the incoming threat: what it is, severity band, expected impact zone, and timeline to peak.'
            },
            overallConfidence: {
                type: Type.NUMBER,
                description: 'Confidence 0-100 that the proposed plan will measurably reduce response time vs. post-impact dispatch.'
            },
            stagingPlan: {
                type: Type.ARRAY,
                description: '2-5 target districts ordered by priority. Each entry must justify why this location over others.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        district: { type: Type.STRING, description: 'Specific district or taluka name in the affected region.' },
                        priority: { type: Type.STRING, enum: ['Critical', 'High', 'Medium', 'Low'], description: 'Dispatch priority.' },
                        confidence: { type: Type.NUMBER, description: 'Confidence 0-100 that this district will require the staged resources.' },
                        readinessByHour: { type: Type.NUMBER, description: 'Hours before threat peak that resources must be on site. e.g. 36 means stage at least 36h before landfall/peak.' },
                        rationale: { type: Type.STRING, description: 'Why this district: geography, vulnerability, access, historical precedent.' },
                        resources: {
                            type: Type.ARRAY,
                            description: '1-4 resources to stage. resourceType must come ONLY from the allowed enum.',
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    resourceType: { type: Type.STRING, enum: RESOURCE_TYPES, description: 'Inventory category.' },
                                    quantity: { type: Type.NUMBER, description: 'Units to stage.' },
                                    reasoning: { type: Type.STRING, description: 'One sentence on why this resource at this quantity.' }
                                },
                                required: ['resourceType', 'quantity', 'reasoning']
                            }
                        }
                    },
                    required: ['district', 'priority', 'confidence', 'readinessByHour', 'rationale', 'resources']
                }
            },
            keyRisks: {
                type: Type.ARRAY,
                description: '2-4 bullet risks the operator must accept if this plan is NOT executed.',
                items: { type: Type.STRING }
            },
            ragPrecedent: {
                type: Type.STRING,
                description: 'If an organizational RAG memory match was provided, explain how the historical lesson shaped the plan. Else return "No applicable historical precedent."'
            }
        },
        required: ['threatAssessment', 'overallConfidence', 'stagingPlan', 'keyRisks', 'ragPrecedent']
    }
};

const toolConfig = {
    functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: ['submit_prepositioning_plan']
    }
};

const PREDICTION_SYSTEM_INSTRUCTION = `You are the expert AI strategic planner for AI RescueNet, responsible for PRE-POSITIONING resources BEFORE a disaster hits.

Your job is to convert a threat description + region + forecast horizon into a concrete staging plan that places resources where they will be needed, before roads degrade.

ALLOCATION GUIDELINES:
- Choose districts by VULNERABILITY (coastal exposure, flood plain, population density) — not just proximity to the threat center.
- Resources must arrive before access windows close. If landfall is in 24h, readinessByHour for critical resources should be 36+ (i.e. stage 12h before the window closes).
- Medical resources get priority when evacuation populations include dialysis, pregnancy, pediatrics.
- Shelter + water always lead for storm/flood scenarios; they fail fastest at shelter overflow moments.
- Rescue is reserved for forced-evacuation or post-impact retrieval — do NOT over-stage rescue for a low-population district.

CONFIDENCE CALIBRATION:
- 90-100: high-certainty forecast + multiple RAG precedents agree
- 70-89: clear forecast but some uncertainty in magnitude/track
- 50-69: plausible threat with limited precedent
- <50: too uncertain to commit resources; recommend monitoring instead

ORGANIZATIONAL PLAYBOOK — learn from these precedents:
${historicalDisasters.slice(0, 8).map((d, i) => `[#${i + 1}] ${d.event}: ${d.lessonsLearned}`).join('\n')}

OUTPUT CONTRACT:
You MUST respond by calling the submit_prepositioning_plan function. Never reply with plain text. Populate every field. Ensure resourceType uses only the allowed enum values.`;

const TOOLS = [{ functionDeclarations: [submitPrePositioningPlanTool] }];

function parseRetryDelayMs(err) {
    try {
        const payload = typeof err.message === 'string' ? JSON.parse(err.message) : err;
        const details = payload?.error?.details || [];
        const retryInfo = details.find(d => d['@type']?.includes('RetryInfo'));
        if (retryInfo?.retryDelay) {
            const match = retryInfo.retryDelay.match(/^(\d+(?:\.\d+)?)s$/);
            if (match) return Math.ceil(parseFloat(match[1]) * 1000);
        }
    } catch (_) { /* ignore */ }
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
            console.warn(`[PREDICT RETRY] ${err.status} — waiting ${backoff}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, backoff));
        }
    }
    throw lastError;
}

async function generatePrePositioningPlan({ region, threat, horizonHours, weatherContext, ragContext }) {
    if (!HAS_API_KEY) {
        console.warn('[PREDICT OFFLINE] GEMINI_API_KEY not set — using heuristic pre-positioning plan.');
        return buildOfflinePrePositioningPlan({ region, threat, horizonHours });
    }

    const prompt = `PRE-POSITIONING REQUEST

Target region: ${region}
Incoming threat: ${threat}
Forecast horizon: ${horizonHours} hours to peak impact

LIVE WEATHER CONTEXT (Open-Meteo, current conditions in region):
${weatherContext || 'Weather API unresponsive — reason from threat description alone.'}

ORGANIZATIONAL RAG MEMORY (Gemini Embeddings — best semantic match to this threat):
${ragContext || 'No direct RAG match. Rely on the historical playbook in your system instruction.'}

Call submit_prepositioning_plan now with the staging strategy. Pick 2-5 specific districts/talukas in the affected region, not generic zones. Justify each choice.`;

    try {
        const response = await generateWithRetry({
            model: MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                systemInstruction: PREDICTION_SYSTEM_INSTRUCTION,
                tools: TOOLS,
                toolConfig
            }
        });

        const functionCalls = response.functionCalls || [];
        if (functionCalls.length === 0) {
            throw new Error('Gemini did not emit submit_prepositioning_plan despite mode=ANY');
        }

        const args = functionCalls[0].args || {};
        const usage = response.usageMetadata;
        if (usage) {
            const cached = usage.cachedContentTokenCount ?? 0;
            const total = usage.promptTokenCount ?? 0;
            const pct = total > 0 ? Math.round((cached / total) * 100) : 0;
            console.log(`[PREDICT TOKENS] prompt=${total} cached=${cached} (${pct}% implicit hit) output=${usage.candidatesTokenCount ?? 0}`);
        }

        return {
            threatAssessment: args.threatAssessment || 'Threat assessment unavailable.',
            overallConfidence: typeof args.overallConfidence === 'number' ? args.overallConfidence : 50,
            stagingPlan: Array.isArray(args.stagingPlan) ? args.stagingPlan : [],
            keyRisks: Array.isArray(args.keyRisks) ? args.keyRisks : [],
            ragPrecedent: args.ragPrecedent || 'No applicable historical precedent.'
        };
    } catch (error) {
        console.error('Prediction API error — falling back to heuristic offline plan:', error?.message || error);
        return buildOfflinePrePositioningPlan({ region, threat, horizonHours });
    }
}

module.exports = { generatePrePositioningPlan };
