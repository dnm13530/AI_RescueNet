import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const submitRequest = async (requestData) => {
    const response = await axios.post(`${API_URL}/requests`, requestData);
    return response.data;
};

export const getAllocations = async () => {
    const response = await axios.get(`${API_URL}/allocations`);
    return response.data;
};

export const getInventory = async () => {
    const response = await axios.get(`${API_URL}/inventory`);
    return response.data;
};

export const startDemo = async (scenarioId = 'cyclone-biparjoy') => {
    const response = await axios.post(`${API_URL}/demo/start`, { scenarioId });
    return response.data;
};

export const stopDemo = async () => {
    const response = await axios.post(`${API_URL}/demo/stop`);
    return response.data;
};

export const getDemoStatus = async () => {
    const response = await axios.get(`${API_URL}/demo/status`);
    return response.data;
};

export const predictPrePositioning = async ({ region, threat, horizonHours }) => {
    const response = await axios.post(`${API_URL}/predict`, { region, threat, horizonHours });
    return response.data;
};

export const compareScenario = async ({ scenarioId = 'cyclone-biparjoy', stagingPlan }) => {
    const response = await axios.post(`${API_URL}/demo/compare`, { scenarioId, stagingPlan });
    return response.data;
};
