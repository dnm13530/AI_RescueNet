const { generatePrePositioningPlan } = require('../services/predictionService');
const { getLiveWeather } = require('../services/weatherService');
const { findSimilarHistoricalEvent } = require('../services/ragService');

function friendlyError(err) {
    let parsed = null;
    if (typeof err.message === 'string') {
        try { parsed = JSON.parse(err.message); } catch (_) { /* ignore */ }
    }
    const code = err.status || parsed?.error?.code;
    if (code === 503) return 'Gemini is temporarily overloaded (503). Retries exhausted — please try again in a moment.';
    if (code === 429) return 'Gemini Free Tier quota hit (429). Wait a minute or enable billing.';
    const apiMsg = parsed?.error?.message;
    if (apiMsg) return `Gemini API error: ${apiMsg}`;
    return err.message || 'Prediction failed';
}

async function predict(req, res) {
    try {
        const { region, threat, horizonHours } = req.body || {};
        if (!region || !threat) {
            return res.status(400).json({ error: 'Missing required fields: region, threat' });
        }

        const horizon = Number(horizonHours) > 0 ? Number(horizonHours) : 72;

        const [weatherContext, ragContext] = await Promise.all([
            getLiveWeather(region),
            findSimilarHistoricalEvent({
                type: 'prediction',
                location: region,
                urgency: 'Forecast',
                notes: threat
            })
        ]);

        console.log('[PREDICT] weather:', weatherContext);
        console.log('[PREDICT] rag:', ragContext);

        const plan = await generatePrePositioningPlan({
            region,
            threat,
            horizonHours: horizon,
            weatherContext,
            ragContext
        });

        return res.status(200).json({
            region,
            threat,
            horizonHours: horizon,
            generatedAt: new Date().toISOString(),
            weatherContext,
            ragContext: ragContext || null,
            ...plan
        });
    } catch (err) {
        console.error('Predict error:', err);
        const status = err.status === 503 ? 503 : err.status === 429 ? 429 : 500;
        return res.status(status).json({ error: friendlyError(err) });
    }
}

module.exports = { predict };
