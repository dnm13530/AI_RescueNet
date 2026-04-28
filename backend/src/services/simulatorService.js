const fs = require('fs');
const path = require('path');
const db = require('../models/db');

const SCENARIO_DIR = path.join(__dirname, '..', 'data', 'scenarios');

const state = {
    running: false,
    scenarioId: null,
    scenarioName: null,
    startedAt: null,
    timers: [],
    simRequestIds: new Set(),
    inventorySnapshot: null
};

function loadScenario(scenarioId) {
    const file = path.join(SCENARIO_DIR, `${scenarioId}.json`);
    if (!fs.existsSync(file)) {
        throw new Error(`Scenario not found: ${scenarioId}`);
    }
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function emitSimEvent(io, payload) {
    if (!io) return;
    io.emit('new_allocation');
    io.emit('sim_event', payload);
}

function scheduleEvent(io, scenario, event, eventIndex) {
    const timer = setTimeout(() => {
        const id = `sim-${scenario.id}-${eventIndex}-${Date.now()}`;
        const request = {
            id,
            timestamp: new Date().toISOString(),
            simulated: true,
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            phase: event.phase,
            hoursFromLandfall: event.hoursFromLandfall,
            type: event.type,
            location: event.location,
            peopleCount: event.peopleCount,
            urgency: event.urgency,
            notes: event.notes,
            score: event.score,
            reasoning: event.reasoning,
            forecast: event.forecast,
            ragPrecedent: event.ragPrecedent,
            recommendedResources: event.recommendedResources || [],
            detectedLanguage: 'English',
            imageVerification: 'No visual data submitted for AI verification.',
            autoDispatched: !!event.autoDispatched
        };

        db.requests.push(request);
        state.simRequestIds.add(id);

        console.log(`[SIM] ${event.phase} — ${event.location} (score ${event.score})`);
        emitSimEvent(io, {
            kind: 'event',
            request,
            scenarioId: scenario.id,
            phase: event.phase,
            hoursFromLandfall: event.hoursFromLandfall,
            eventIndex,
            totalEvents: scenario.events.length
        });
    }, event.tMs);

    state.timers.push(timer);
}

function scheduleCompletion(io, scenario) {
    const endAt = scenario.compressedDurationMs + 500;
    const timer = setTimeout(() => {
        console.log(`[SIM] Scenario "${scenario.name}" complete.`);
        state.running = false;
        if (io) {
            io.emit('sim_event', {
                kind: 'complete',
                scenarioId: scenario.id,
                scenarioName: scenario.name
            });
        }
    }, endAt);
    state.timers.push(timer);
}

function clearAllTimers() {
    state.timers.forEach(t => clearTimeout(t));
    state.timers = [];
}

function removeSimulatedFromDb() {
    if (state.simRequestIds.size === 0) return;
    db.requests = db.requests.filter(r => !state.simRequestIds.has(r.id));
    state.simRequestIds.clear();
}

function restoreInventorySnapshot() {
    if (!state.inventorySnapshot) return;
    Object.keys(state.inventorySnapshot).forEach(k => {
        db.inventory[k] = state.inventorySnapshot[k];
    });
    state.inventorySnapshot = null;
}

function startScenario(io, scenarioId = 'cyclone-biparjoy') {
    if (state.running) {
        return { ok: false, error: 'A scenario is already running. Stop it first.' };
    }

    const scenario = loadScenario(scenarioId);

    state.running = true;
    state.scenarioId = scenario.id;
    state.scenarioName = scenario.name;
    state.startedAt = Date.now();
    state.simRequestIds = new Set();
    state.inventorySnapshot = { ...db.inventory };

    if (io) {
        io.emit('sim_event', {
            kind: 'start',
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            totalEvents: scenario.events.length,
            compressedDurationMs: scenario.compressedDurationMs
        });
    }

    scenario.events.forEach((event, idx) => scheduleEvent(io, scenario, event, idx));
    scheduleCompletion(io, scenario);

    console.log(`[SIM] Started "${scenario.name}" — ${scenario.events.length} events over ${scenario.compressedDurationMs}ms.`);
    return {
        ok: true,
        scenario: {
            id: scenario.id,
            name: scenario.name,
            totalEvents: scenario.events.length,
            compressedDurationMs: scenario.compressedDurationMs
        }
    };
}

function stopScenario(io) {
    const wasRunning = state.running;
    clearAllTimers();
    removeSimulatedFromDb();
    restoreInventorySnapshot();

    state.running = false;
    const lastScenarioId = state.scenarioId;
    const lastScenarioName = state.scenarioName;
    state.scenarioId = null;
    state.scenarioName = null;
    state.startedAt = null;

    if (io) {
        io.emit('new_allocation');
        io.emit('sim_event', {
            kind: 'stop',
            scenarioId: lastScenarioId,
            scenarioName: lastScenarioName
        });
    }

    console.log(`[SIM] Stopped. Simulated requests cleared, inventory restored.`);
    return { ok: true, wasRunning };
}

function getStatus() {
    return {
        running: state.running,
        scenarioId: state.scenarioId,
        scenarioName: state.scenarioName,
        startedAt: state.startedAt,
        elapsedMs: state.startedAt ? Date.now() - state.startedAt : 0,
        simulatedRequestCount: state.simRequestIds.size
    };
}

module.exports = {
    startScenario,
    stopScenario,
    getStatus
};
