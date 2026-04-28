const { GoogleGenAI } = require('@google/genai');
const { historicalDisasters } = require('../models/historyDb');

const HAS_API_KEY = !!process.env.GEMINI_API_KEY;
const ai = HAS_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const EMBEDDING_MODEL = 'gemini-embedding-001';
const SIMILARITY_THRESHOLD = 0.55;

let historicalEmbeddingsCache = [];
let offlineMode = false;

// Lightweight keyword index used when Gemini Embeddings are unavailable.
// Maps the request "type" (food, medical, shelter, water, rescue, transport,
// clothing, sanitation) and a few situational keywords to historical events.
const KEYWORD_INDEX = [
    { keywords: ['flood', 'rain', 'water', 'cyclone', 'storm'], match: 'flood' },
    { keywords: ['earthquake', 'quake', 'tremor', 'collapse', 'rubble'], match: 'earthquake' },
    { keywords: ['fire', 'burn', 'smoke', 'wildfire'], match: 'fire' },
    { keywords: ['heat', 'heatwave', 'heatstroke', 'temperature'], match: 'heat' },
    { keywords: ['landslide', 'mudslide', 'debris'], match: 'landslide' },
    { keywords: ['medical', 'injury', 'wounded', 'casualty', 'trauma'], match: 'medical' },
    { keywords: ['shelter', 'tent', 'displaced', 'homeless'], match: 'shelter' },
    { keywords: ['rescue', 'trapped', 'stranded', 'evacuation'], match: 'rescue' }
];

function findKeywordPrecedent(requestData) {
    const haystack = `${requestData.type || ''} ${requestData.notes || ''} ${requestData.location || ''}`.toLowerCase();
    let theme = null;
    for (const entry of KEYWORD_INDEX) {
        if (entry.keywords.some(k => haystack.includes(k))) {
            theme = entry.match;
            break;
        }
    }
    if (!theme) return null;

    const themeMap = {
        flood: 'flood',
        earthquake: 'earthquake',
        fire: 'fire',
        heat: 'heat',
        landslide: 'landslide',
        medical: 'tsunami', // medical trauma archetype
        shelter: 'cyclone',
        rescue: 'earthquake'
    };
    const probe = themeMap[theme];
    const match = historicalDisasters.find(d =>
        d.event.toLowerCase().includes(probe) || d.description.toLowerCase().includes(probe)
    );
    if (!match) return null;

    return `[KEYWORD PRECEDENT — offline mode]: ${match.event}. RAG Historic Analysis: ${match.description}. CRITICAL ORGANIZATIONAL LESSON: ${match.lessonsLearned}`;
}

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embed(text, taskType) {
    const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: { taskType }
    });
    return response.embeddings[0].values;
}

async function embedBatch(texts, taskType) {
    const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: texts,
        config: { taskType }
    });
    return response.embeddings.map(e => e.values);
}

async function initializeKnowledgeBase() {
    console.log('==== INITIALIZING GEMINI EMBEDDINGS RAG DATABASE ====');
    historicalEmbeddingsCache = [];

    if (!HAS_API_KEY) {
        offlineMode = true;
        console.warn(`[RAG OFFLINE]: GEMINI_API_KEY not set — falling back to keyword-based precedent lookup over ${historicalDisasters.length} historical events.`);
        return;
    }

    try {
        const texts = historicalDisasters.map(d =>
            `Event: ${d.event}. Context: ${d.description}. Lessons: ${d.lessonsLearned}`
        );
        const vectors = await embedBatch(texts, 'RETRIEVAL_DOCUMENT');
        historicalDisasters.forEach((disaster, i) => {
            historicalEmbeddingsCache.push({ ...disaster, vector: vectors[i] });
        });
        console.log(`[RAG ENGINE LIVE]: Embedded ${historicalEmbeddingsCache.length} historical events via Gemini Embeddings (${vectors[0].length}-dim).`);
    } catch (err) {
        offlineMode = true;
        console.warn(`[RAG OFFLINE]: Embedding init failed (${err?.message || err}) — falling back to keyword-based precedent lookup over ${historicalDisasters.length} historical events.`);
    }
}

async function findSimilarHistoricalEvent(requestData) {
    if (offlineMode || historicalEmbeddingsCache.length === 0) {
        return findKeywordPrecedent(requestData);
    }

    const queryText = `Emergency aid request. Required aid type: ${requestData.type}. Situation notes: ${requestData.notes || 'none'}. Location: ${requestData.location}. Urgency level: ${requestData.urgency || 'unspecified'}.`;
    console.log('RAG QUERY TEXT:', queryText);

    let queryVector;
    try {
        queryVector = await embed(queryText, 'RETRIEVAL_QUERY');
    } catch (err) {
        console.warn(`[RAG] Query embedding failed (${err?.message || err}) — falling back to keyword precedent.`);
        return findKeywordPrecedent(requestData);
    }

    const results = historicalEmbeddingsCache
        .map(hEvent => ({
            event: hEvent.event,
            similarity: cosineSimilarity(queryVector, hEvent.vector),
            fullData: hEvent
        }))
        .sort((a, b) => b.similarity - a.similarity);

    console.log('=== RAG TOP 3 MATCHES (Gemini Embeddings) ===');
    results.slice(0, 3).forEach((r, i) => {
        console.log(`  #${i + 1}: ${r.event} — ${(r.similarity * 100).toFixed(1)}%`);
    });

    const best = results[0];
    if (best && best.similarity >= SIMILARITY_THRESHOLD) {
        return `[SEMANTIC MATCH ${Math.round(best.similarity * 100)}% — Gemini Embeddings]: ${best.fullData.event}. RAG Historic Analysis: ${best.fullData.description}. CRITICAL ORGANIZATIONAL LESSON: ${best.fullData.lessonsLearned}`;
    }

    return null;
}

module.exports = {
    initializeKnowledgeBase,
    findSimilarHistoricalEvent
};
