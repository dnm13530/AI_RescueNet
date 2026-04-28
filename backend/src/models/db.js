// Simple in-memory database
const db = {
    requests: [],
    // Current available resources
    inventory: {
        food: 100,
        medical: 20,
        shelter: 50,
        water: 200,
        rescue: 15,
        transport: 30,
        clothing: 80,
        sanitation: 40
    }
};

module.exports = db;
