const axios = require('axios');

const API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

// Heuristic: skip translation when text is empty or already plainly ASCII English-ish
function looksEnglish(text) {
    if (!text) return true;
    // If >95% of chars are ASCII letters/digits/punctuation/whitespace, treat as English
    const asciiCount = [...text].filter(c => c.charCodeAt(0) < 128).length;
    return asciiCount / text.length > 0.95;
}

async function translateIfNeeded(text) {
    if (!API_KEY || !text || text.length < 3) return null;
    if (looksEnglish(text)) return null;

    try {
        const res = await axios.post(`${ENDPOINT}?key=${API_KEY}`, {
            q: text,
            target: 'en',
            format: 'text'
        }, { timeout: 5000 });

        const t = res.data?.data?.translations?.[0];
        if (!t) return null;

        const sourceLang = (t.detectedSourceLanguage || '').toLowerCase();
        const translated = t.translatedText;

        if (!translated || sourceLang === 'en' || translated.trim() === text.trim()) {
            return null;
        }

        const langName = ({
            hi: 'Hindi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', mr: 'Marathi',
            gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi', or: 'Odia',
            ur: 'Urdu', as: 'Assamese', es: 'Spanish', fr: 'French', de: 'German',
            zh: 'Chinese', ja: 'Japanese', ar: 'Arabic', pt: 'Portuguese', ru: 'Russian'
        })[sourceLang] || sourceLang.toUpperCase();

        return { translatedText: translated, sourceLanguage: langName };
    } catch (err) {
        console.error('Translation API error:', err.response?.data?.error?.message || err.message);
        return null;
    }
}

module.exports = { translateIfNeeded };
