const db = require('../models/db');
const { analyzeRequestPrioritiy } = require('../services/geminiService');
const { calculateAllocations } = require('../services/allocationService');
const { sendEmergencyCard } = require('../services/googleChatService');
const { getLiveWeather, geocodeLocation } = require('../services/weatherService');
const { translateIfNeeded } = require('../services/translationService');
const { findSimilarHistoricalEvent } = require('../services/ragService');
const { getLiveDisasterIntel } = require('../services/groundingService');

async function submitRequest(req, res) {
    try {
        const requestData = req.body;
        
        // Basic validation
        if (!requestData.type || !requestData.peopleCount || !requestData.location) {
            return res.status(400).json({ error: "Missing required fields: type, peopleCount, location" });
        }

        // Live weather, geocoding, translation, semantic RAG, and (gated) grounding in parallel
        const [liveWeatherContext, geocode, translation, ragContext, liveIntelContext] = await Promise.all([
            getLiveWeather(requestData.location),
            geocodeLocation(requestData.location),
            translateIfNeeded(requestData.notes),
            findSimilarHistoricalEvent(requestData),
            getLiveDisasterIntel(requestData)
        ]);
        console.log("WEATHER CONTEXT GENERATED:", liveWeatherContext);
        console.log("RAG CONTEXT GENERATED:", ragContext);
        console.log("LIVE INTEL GENERATED:", liveIntelContext);

        // Call Gemini with Function Calling — inject weather, RAG, and (when enabled) live-web intel
        const { score, baseReasoning, predictiveForecast, imageVerification, detectedLanguage, ragPrecedent, recommendedResources } = await analyzeRequestPrioritiy(requestData, liveWeatherContext, ragContext, liveIntelContext);
        console.log("GEMINI OUTPUT RAG PRECEDENT:", ragPrecedent);

        // Save to DB
        const newRequest = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            ...requestData,
            // Use translated text (if non-English) for downstream display; keep original separately
            notes: translation?.translatedText || requestData.notes,
            originalNotes: translation?.translatedText ? requestData.notes : undefined,
            translationSourceLanguage: translation?.sourceLanguage || undefined,
            coords: geocode ? { lat: geocode.lat, lng: geocode.lng } : null,
            resolvedLocation: geocode?.resolvedName || null,
            score,
            reasoning: baseReasoning, // Standard base reasoning
            forecast: predictiveForecast, // Advanced Temporal prediction
            imageVerification, // New Vision AI analysis
            detectedLanguage: translation?.sourceLanguage ? translation.sourceLanguage : detectedLanguage,
            ragPrecedent, // Enterprise organizational memory
            recommendedResources, // Agentic allocation plan emitted via Gemini Function Calling
            autoDispatched: score >= 80
        };

        if (newRequest.autoDispatched) {
            // fire and forget alert dispatch
            sendEmergencyCard(newRequest, score, baseReasoning);
        }

        db.requests.push(newRequest);

        // Feature 2: Broadcast Live Update to all screens without manually refreshing
        const currentIo = req.app.locals.io;
        if (currentIo) {
            currentIo.emit('new_allocation');
        }

        return res.status(201).json({
            message: "Request submitted successfully",
            request: newRequest
        });
    } catch (error) {
        console.error("Error submitting request:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

function getAllocations(req, res) {
    try {
        const result = calculateAllocations();
        res.json(result);
    } catch (error) {
        console.error("Error calculating allocations:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

function getInventory(req, res) {
    res.json(db.inventory);
}

module.exports = {
    submitRequest,
    getAllocations,
    getInventory
};
