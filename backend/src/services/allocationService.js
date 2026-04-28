const db = require('../models/db');

function calculateAllocations() {
    // Sort requests by score descending
    const sortedRequests = [...db.requests].sort((a, b) => b.score - a.score);
    
    // Clone inventory to track remaining capacity without mutating global
    let currentInventory = { ...db.inventory };
    
    const allocations = sortedRequests.map(req => {
        const type = req.type.toLowerCase(); // Expected to be food, medical, or shelter
        const needs = parseInt(req.peopleCount, 10);
        
        let status = 'Pending';
        let allocatedAmount = 0;

        if (currentInventory[type] !== undefined) {
            if (currentInventory[type] >= needs) {
                allocatedAmount = needs;
                currentInventory[type] -= needs;
                status = 'Fully Fulfilled';
            } else if (currentInventory[type] > 0) {
                allocatedAmount = currentInventory[type];
                currentInventory[type] = 0;
                status = 'Partially Fulfilled';
            } else {
                status = 'Pending (No Resources)';
            }
        } else {
            status = 'Invalid Resource Type';
        }

        return {
            ...req,
            status,
            allocatedAmount
        };
    });

    return {
        allocations,
        remainingInventory: currentInventory
    };
}

module.exports = {
    calculateAllocations
};
