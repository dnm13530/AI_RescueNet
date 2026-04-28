# AI RescueNet

AI-powered disaster relief management system that auto-prioritizes emergency aid using **Google Gemini 2.5-Flash**, **Gemini Embeddings RAG** over 20 Indian disaster precedents, **Google Maps Platform** for live operations geo-visualization, **Cloud Translation API** for multilingual intake, **Open-Meteo** live weather, and **Gemini Vision** for image verification. Built for the **Google Solution Challenge 2026**.

**Live demo:** https://ai-rescue-net.vercel.app · **Admin dashboard:** https://ai-rescue-net.vercel.app/admin

---

## Pipeline

`POST /api/requests` →
1. **Open-Meteo** geocoding + current weather (parallel) — coordinates persisted on each request for the live ops map
2. **Cloud Translation API** — auto-detects non-English notes (Hindi, Gujarati, Tamil, Bengali, …) and translates to English for the AI pipeline; original text retained for the dashboard (parallel)
3. **Gemini Embeddings RAG** — 3072-dim cosine match over 20 historical events (parallel)
4. **Google Search grounding** — gated live web intel (parallel)
5. **Gemini 2.5-Flash + Function Calling** — typed, enum-constrained plan: score 0-100, reasoning, 12-24h forecast, image verification, language detection, ranked resource list
6. Score ≥ 80 → **Google Chat webhook** auto-dispatch
7. **Socket.io** broadcast to every connected admin dashboard, where **Google Maps Platform** drops a priority-coloured pin (red ≥80 / amber 50-79 / green <50) on the live ops map

Plus:
- **Predictive Pre-Positioning Engine** — `POST /api/predict` stages resources *before* impact via a second function-calling tool
- **Scenario Simulator** — replays 2023 Cyclone Biparjoy (14 events / 180s) with pre-baked AI for Free-Tier-proof demos
- **Heuristic offline fallback** — full pipeline keeps producing plans even when Gemini is unavailable

---

## Quick start

```bash
# Backend (port 5000)
cd backend
npm install
echo "GEMINI_API_KEY=your_key_here" > .env
echo "ENABLE_GROUNDING=false" >> .env
npm start

# Frontend (port 5173)
cd ../frontend
npm install
npm run dev
```

Open http://localhost:5173 to submit, http://localhost:5173/admin for the live dashboard.

> Without a `GEMINI_API_KEY`, the server boots in offline mode using keyword-RAG and heuristic priority scoring — useful for development and Free-Tier-exhausted demos.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Socket.io-client, Web Speech API, **`@vis.gl/react-google-maps`** (vector AdvancedMarkers + InfoWindow) |
| Backend | Node.js, Express, Socket.io, `@google/genai` SDK |
| AI | Gemini 2.5-Flash · Gemini Embeddings (`gemini-embedding-001`) · Gemini Vision · Google Search Grounding |
| Google Cloud | **Maps JavaScript API** (live ops map) · **Cloud Translation API v2** (multilingual intake) · Google Chat webhook (auto-dispatch) |
| Data | In-memory DB, 20-event historical playbook, Cyclone Biparjoy scenario JSON |
| External | Open-Meteo (weather + geocoding) |
| Hosting | Render (backend) · Vercel (frontend) |

---

## Project layout

```
backend/
  src/
    server.js                    Express + Socket.io entrypoint (port 5000)
    routes/                      apiRoutes.js
    controllers/                 requestController, predictionController, demoController
    services/
      geminiService.js           2.5-Flash + Function Calling + offline fallback
      ragService.js              Embeddings RAG + keyword offline fallback
      groundingService.js        Google Search grounding (gated)
      predictionService.js       Pre-positioning planner + offline fallback
      weatherService.js          Open-Meteo geocoding + current conditions
      googleChatService.js       Auto-dispatch webhook
      simulatorService.js        Cyclone Biparjoy replay (no Gemini calls)
      translationService.js      Cloud Translation API v2 wrapper (auto-detect → en)
      cacheService.js            Static system instruction + tool schema
      allocationService.js       Inventory decrement + sort
    models/
      db.js                      In-memory state
      historyDb.js               20 Indian disaster precedents
    data/scenarios/
      cyclone-biparjoy.json      14-event scenario for the simulator

frontend/
  src/
    App.jsx                      React Router
    pages/
      SubmitRequestPage.jsx      Voice / image / text intake
      AdminDashboard.jsx         Live feed + simulator + predict panel + ops map
    components/
      AllocationsMap.jsx         Google Maps live ops view (priority-coloured pins)
    services/api.js              Axios + Socket.io client
    index.css                    Glassmorphism design system
```

---

## Submission artefacts

- `AI_RescueNet_Submission_Deck.pptx` — completed Solution Challenge prototype deck
- `SUBMISSION_TEXT.md` — problem statement + solution overview text for the form
- `DEMO_VIDEO_SCRIPT.md` — 3-minute recording script
- `PROJECT_STATUS.md` — feature audit + Google AI tech coverage matrix

---

## Environment variables

**Backend** (`backend/.env` locally, Render Environment in production):

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | for live mode | Gemini 2.5-Flash + Embeddings + Vision |
| `GOOGLE_TRANSLATE_API_KEY` | for non-English intake | Cloud Translation API v2 — auto-translates request notes to English |
| `GOOGLE_CHAT_WEBHOOK_URL` | optional | Auto-dispatch alert cards |
| `ENABLE_GROUNDING` | optional | `false` (default) gates Google Search grounding to save Free-Tier quota |
| `CORS_ORIGIN` | production | Comma-separated origins allowed to call the API (e.g. `https://ai-rescue-net.vercel.app`) |

**Frontend** (Vercel Environment Variables — must be set *before* the build runs; Vite bakes them into the bundle):

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_BASE` | yes | Backend origin (e.g. `https://ai-rescuenet-api.onrender.com`) |
| `VITE_GOOGLE_MAPS_API_KEY` | for the ops map | Maps JavaScript API key, restricted by HTTP referrer to the Vercel domain |
| `VITE_GOOGLE_MAPS_MAP_ID` | for AdvancedMarker | Vector Map ID from Google Maps Platform → Map Management |

---

## License

MIT (or specify before publishing).
