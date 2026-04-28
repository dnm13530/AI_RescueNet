const { compareScenario } = require('../services/comparisonService');

function compare(req, res) {
    try {
        const { scenarioId = 'cyclone-biparjoy', stagingPlan = [] } = req.body || {};
        if (!Array.isArray(stagingPlan) || stagingPlan.length === 0) {
            return res.status(400).json({ error: 'stagingPlan is required. Run /api/predict first to generate one.' });
        }
        const result = compareScenario(scenarioId, stagingPlan);
        return res.status(200).json(result);
    } catch (err) {
        console.error('Compare error:', err);
        return res.status(500).json({ error: err.message || 'Comparison failed' });
    }
}

module.exports = { compare };
