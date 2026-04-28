const { startScenario, stopScenario, getStatus } = require('../services/simulatorService');

function startDemo(req, res) {
    try {
        const io = req.app.locals.io;
        const scenarioId = (req.body && req.body.scenarioId) || 'cyclone-biparjoy';
        const result = startScenario(io, scenarioId);
        if (!result.ok) {
            return res.status(409).json(result);
        }
        return res.status(200).json(result);
    } catch (err) {
        console.error('Demo start error:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Failed to start scenario' });
    }
}

function stopDemo(req, res) {
    try {
        const io = req.app.locals.io;
        const result = stopScenario(io);
        return res.status(200).json(result);
    } catch (err) {
        console.error('Demo stop error:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Failed to stop scenario' });
    }
}

function demoStatus(req, res) {
    res.json(getStatus());
}

module.exports = { startDemo, stopDemo, demoStatus };
