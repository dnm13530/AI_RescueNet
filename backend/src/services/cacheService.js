const { Type } = require('@google/genai');
const { historicalDisasters } = require('../models/historyDb');

// NOTE: Gemini 2.5 performs implicit context caching automatically whenever the
// same prefix (systemInstruction + tools + contents prefix) recurs across requests
// — no caches.create() call required. This file assembles the static "prefix"
// that implicit caching can key on: system instruction + tool declaration +
// tool config. The Free Tier blocks explicit cache creation, but implicit
// caching remains active.

const RESOURCE_TYPES = ['food', 'medical', 'shelter', 'water', 'rescue', 'transport', 'clothing', 'sanitation'];

const submitPriorityAnalysisTool = {
    name: 'submit_priority_analysis',
    description: 'Submit the final priority analysis and resource allocation recommendation for a disaster aid request. You MUST call this function with every request. Populate every field based on the request text, live weather, RAG precedent, live web intel (when available), and (if present) the attached image.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            score: {
                type: Type.NUMBER,
                description: 'Priority score 0-100. Scale UP when live weather exacerbates the emergency or RAG precedent indicates high historical fatality. >=80 triggers auto-dispatch.'
            },
            baseReasoning: { type: Type.STRING, description: 'Standard analysis based strictly on the user text. Translate to English.' },
            predictiveForecast: { type: Type.STRING, description: '12-24 hour trajectory analysis. MUST begin by quoting the actual temperature, wind speed, and condition from LIVE ENVIRONMENT CONTEXT, then reason forward about how those conditions affect the emergency over the next 12-24h. If weather API was unresponsive, state that explicitly.' },
            imageVerification: { type: Type.STRING, description: 'If an image was attached, confirm whether it matches the request. Else return "No visual data processed."' },
            detectedLanguage: { type: Type.STRING, description: 'Original source language of the request. Default "English".' },
            ragPrecedent: { type: Type.STRING, description: 'If RAG memory matched, detail how the historical lesson altered your decision. Else return "Verified against memory: No applicable historical precedent required."' },
            recommendedResources: {
                type: Type.ARRAY,
                description: `Ranked list of resources to dispatch. Select resourceType ONLY from: ${RESOURCE_TYPES.join(', ')}. Typically 1-3 entries.`,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        resourceType: { type: Type.STRING, enum: RESOURCE_TYPES, description: 'Inventory category.' },
                        quantity: { type: Type.NUMBER, description: 'Units to dispatch, scaled to peopleCount and severity.' },
                        reasoning: { type: Type.STRING, description: 'One sentence explaining why this resource at this quantity.' }
                    },
                    required: ['resourceType', 'quantity', 'reasoning']
                }
            }
        },
        required: ['score', 'baseReasoning', 'predictiveForecast', 'imageVerification', 'detectedLanguage', 'ragPrecedent', 'recommendedResources']
    }
};

function buildPlaybookBlock() {
    return historicalDisasters.map((d, i) =>
        `[#${i + 1}] ${d.event}\n  Context: ${d.description}\n  Lesson: ${d.lessonsLearned}`
    ).join('\n\n');
}

function buildSystemInstruction() {
    return `You are the expert AI dispatcher for AI RescueNet, an emergency disaster relief coordination system operated alongside NDRF/SDRF in India. You have agentic authority: decide both the priority score AND which resources to pre-allocate.

ALLOCATION GUIDELINES:
- Food requests are medium/high depending on days without food.
- Medical requests are nearly always high and scale with injury severity.
- Shelter requests depend on weather exposure and vulnerability.
- High peopleCount + high urgency must push scores upward.
- If live weather exacerbates the emergency (heavy rain during shelter, heatwave during water), scale UP.
- Live web intel (when provided) reflects ground truth RIGHT NOW — if NDRF is already deployed or evacuations are underway, avoid double-dispatch.
- The RAG lesson is your organizational memory — use it to pick tactics, not just scoring.

PRIORITY SCORE BANDS:
- 0-39: low / advisory
- 40-59: medium / monitor
- 60-79: high / dispatch within 4h
- 80-100: critical / auto-dispatch immediately via Google Chat webhook

ORGANIZATIONAL PLAYBOOK — 20 HISTORICAL PRECEDENTS (long-term pattern memory, independent of the single RAG match retrieved per request):

${buildPlaybookBlock()}

OUTPUT CONTRACT:
You MUST respond by calling the submit_priority_analysis function. Never reply with plain text. Populate every field. Ensure recommendedResources uses only the allowed enum resourceType values.`;
}

const toolConfig = {
    functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: ['submit_priority_analysis']
    }
};

module.exports = {
    submitPriorityAnalysisTool,
    buildSystemInstruction,
    toolConfig
};
