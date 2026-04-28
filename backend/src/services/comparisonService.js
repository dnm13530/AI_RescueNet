const fs = require('fs');
const path = require('path');
const db = require('../models/db');

const SCENARIO_DIR = path.join(__dirname, '..', 'data', 'scenarios');

// Calibration constants for demo narrative:
// - Without AI: central-depot dispatch averages ~14h to affected district.
// - With AI pre-staging: resources are already local, first delivery ~45 min.
const BASELINE_DELIVERY_HOURS = 14;
const PRESTAGED_DELIVERY_HOURS = 0.75;

function loadScenario(scenarioId) {
    const file = path.join(SCENARIO_DIR, `${scenarioId}.json`);
    if (!fs.existsSync(file)) {
        throw new Error(`Scenario not found: ${scenarioId}`);
    }
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function inventoryFromStagingPlan(stagingPlan) {
    const totals = {};
    if (!Array.isArray(stagingPlan)) return totals;
    for (const district of stagingPlan) {
        const resources = Array.isArray(district.resources) ? district.resources : [];
        for (const r of resources) {
            const type = r.resourceType;
            const qty = Number(r.quantity) || 0;
            if (!type || qty <= 0) continue;
            totals[type] = (totals[type] || 0) + qty;
        }
    }
    return totals;
}

function runAllocation(events, startingInventory, { prestaged }) {
    const inv = { ...startingInventory };
    let fulfilled = 0;
    let partial = 0;
    let pending = 0;
    let criticalStarved = 0; // score >= 80 NOT fully fulfilled
    let criticalFulfilled = 0;
    let totalUnitsAllocated = 0;
    const deliveryHours = [];

    // Sort events by tMs so we process them in the order they'd arrive.
    const ordered = [...events].sort((a, b) => a.tMs - b.tMs);

    for (const e of ordered) {
        const type = e.type;
        const need = Number(e.peopleCount) || 0;
        const isCritical = Number(e.score) >= 80;

        if (inv[type] === undefined || need <= 0) {
            pending++;
            if (isCritical) criticalStarved++;
            continue;
        }

        if (inv[type] >= need) {
            fulfilled++;
            totalUnitsAllocated += need;
            inv[type] -= need;
            if (isCritical) criticalFulfilled++;
            deliveryHours.push(prestaged ? PRESTAGED_DELIVERY_HOURS : BASELINE_DELIVERY_HOURS);
        } else if (inv[type] > 0) {
            partial++;
            totalUnitsAllocated += inv[type];
            inv[type] = 0;
            if (isCritical) criticalStarved++;
            deliveryHours.push(BASELINE_DELIVERY_HOURS); // partial always reactive
        } else {
            pending++;
            if (isCritical) criticalStarved++;
        }
    }

    const avgDeliveryHours = deliveryHours.length
        ? deliveryHours.reduce((a, b) => a + b, 0) / deliveryHours.length
        : null;
    const firstDeliveryHours = deliveryHours.length ? Math.min(...deliveryHours) : null;
    const fulfillmentRate = ordered.length ? Math.round((fulfilled / ordered.length) * 100) : 0;

    return {
        totalEvents: ordered.length,
        fulfilled,
        partial,
        pending,
        criticalFulfilled,
        criticalStarved,
        totalUnitsAllocated,
        avgDeliveryHours,
        firstDeliveryHours,
        fulfillmentRate,
        remainingInventory: inv
    };
}

function compareScenario(scenarioId, stagingPlan) {
    const scenario = loadScenario(scenarioId);
    const baselineInventory = { ...db.inventory };
    const stagedTotals = inventoryFromStagingPlan(stagingPlan);

    const prePositionedInventory = { ...baselineInventory };
    Object.keys(stagedTotals).forEach(type => {
        if (prePositionedInventory[type] !== undefined) {
            prePositionedInventory[type] += stagedTotals[type];
        }
    });

    const baseline = runAllocation(scenario.events, baselineInventory, { prestaged: false });
    const withAI = runAllocation(scenario.events, prePositionedInventory, { prestaged: true });

    return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        baselineInventory,
        stagedTotals,
        prePositionedInventory,
        baseline,
        withAI,
        delta: {
            additionalFulfilled: withAI.fulfilled - baseline.fulfilled,
            additionalCriticalFulfilled: withAI.criticalFulfilled - baseline.criticalFulfilled,
            criticalStarvedReduction: baseline.criticalStarved - withAI.criticalStarved,
            avgDeliveryHoursReduction:
                baseline.avgDeliveryHours !== null && withAI.avgDeliveryHours !== null
                    ? baseline.avgDeliveryHours - withAI.avgDeliveryHours
                    : null
        }
    };
}

module.exports = { compareScenario };
