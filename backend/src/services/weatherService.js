const axios = require('axios');

async function geocodeLocation(locationText) {
    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationText)}&count=1&language=en&format=json`;
        const geoRes = await axios.get(geoUrl);
        if (!geoRes.data.results || geoRes.data.results.length === 0) return null;
        const loc = geoRes.data.results[0];
        return {
            lat: loc.latitude,
            lng: loc.longitude,
            resolvedName: `${loc.name}${loc.admin1 ? ', ' + loc.admin1 : ''}${loc.country ? ', ' + loc.country : ''}`
        };
    } catch (error) {
        console.error('Geocoding error:', error.message);
        return null;
    }
}

async function getLiveWeather(locationText) {
    try {
        // 1. Geocode the location text to Lat/Long using Open-Meteo
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationText)}&count=1&language=en&format=json`;
        const geoRes = await axios.get(geoUrl);
        
        if (!geoRes.data.results || geoRes.data.results.length === 0) {
            return "Unable to determine precise real-world coordinates for this location.";
        }
        
        const loc = geoRes.data.results[0];
        const lat = loc.latitude;
        const lon = loc.longitude;
        const resolvedName = `${loc.name}, ${loc.country || ''}`;

        // 2. Fetch live weather using exact coordinates (includes WMO weather code for conditions)
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
        const weatherRes = await axios.get(weatherUrl);
        
        const current = weatherRes.data.current_weather;
        
        // Simple mapping for WMO weather codes (simplified for prompt injection)
        const weatherCodeMap = {
            0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Fog", 51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
            61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
            71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
            80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
            95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
        };
        
        const condition = weatherCodeMap[current.weathercode] || "Unknown severe condition";
        
        return `Location resolved as [${resolvedName}]. Live Weather Coordinates (Lat: ${lat}, Lon: ${lon}). Current active conditions: ${condition}, Temperature: ${current.temperature}°C, Wind Speed: ${current.windspeed} km/h.`;

    } catch (error) {
        console.error("Open-Meteo API Error:", error.message);
        return "Live weather API temporarily unresponsive.";
    }
}

module.exports = {
    getLiveWeather,
    geocodeLocation
};
