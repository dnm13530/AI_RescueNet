const { GoogleGenAI } = require('@google/genai');

const HAS_API_KEY = !!process.env.GEMINI_API_KEY;
const ai = HAS_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// Gated feature. Grounding adds one extra Gemini 2.5-Flash call per request.
// Disabled by default on Free Tier to conserve quota. Enable by removing the
// ENABLE_GROUNDING=false line from backend/.env (or setting it to true) once
// billing is active on the Gemini API key.
async function getLiveDisasterIntel(requestData) {
    if (process.env.ENABLE_GROUNDING === 'false') {
        console.log('[GROUNDING] Disabled via ENABLE_GROUNDING=false — skipping live web intel.');
        return null;
    }
    if (!HAS_API_KEY) {
        console.log('[GROUNDING] No GEMINI_API_KEY — skipping live web intel.');
        return null;
    }

    const query = `Latest disaster, weather-emergency, or relief-operation news for ${requestData.location} in the last 48 hours. Focus on: active NDRF/SDRF deployments, IMD alerts, evacuation orders, road/transport closures, hospital capacity, and any ongoing relief operations relevant to a ${requestData.type} request. Summarize in 3-4 tight bullet points. If no relevant live intel exists, say so explicitly.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: query,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        const summary = response.text?.trim();
        const grounding = response.candidates?.[0]?.groundingMetadata;
        const citations = (grounding?.groundingChunks || [])
            .map(c => c.web?.uri)
            .filter(Boolean)
            .slice(0, 5);

        console.log(`[GROUNDING] ${citations.length} live sources retrieved for ${requestData.location}`);

        if (!summary) return null;

        const citationBlock = citations.length
            ? `\nSources: ${citations.join(' | ')}`
            : '';

        return `[GOOGLE SEARCH GROUNDING — LIVE WEB INTEL]\n${summary}${citationBlock}`;
    } catch (error) {
        console.error('[GROUNDING] Failed to fetch live intel:', error.message);
        return null;
    }
}

module.exports = {
    getLiveDisasterIntel
};
