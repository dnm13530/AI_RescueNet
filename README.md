# AI RescueNet

AI-powered disaster relief management system that auto-prioritizes emergency aid using **Google Gemini 2.5-Flash**, **Gemini Embeddings RAG** over 20 Indian disaster precedents, **Open-Meteo** live weather, and **Gemini Vision** for image verification. Built for the **Google Solution Challenge 2026**.

---

## Pipeline

`POST /api/requests` →
1. **Open-Meteo** geocoding + current weather (parallel)
2. **Gemini Embeddings RAG** — 3072-dim cosine match over 20 historical events (parallel)
3. **Google Search grounding** — gated live web intel (parallel)
4. **Gemini 2.5-Flash + Function Calling** — typed, enum-constrained plan: score 0-100, reasoning, 12-24h forecast, image verification, language detection, ranked resource list
5. Score ≥ 80 → **Google Chat webhook** auto-dispatch
6. **Socket.io** broadcast to every connected admin dashboard

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
| Frontend | React 18, Vite, Socket.io-client, Web Speech API |
| Backend | Node.js, Express, Socket.io, `@google/genai` SDK |
| AI | Gemini 2.5-Flash · Gemini Embeddings (`gemini-embedding-001`) · Gemini Vision · Google Search Grounding |
| Data | In-memory DB, 20-event historical playbook, Cyclone Biparjoy scenario JSON |
| External | Open-Meteo (weather) · Google Chat webhook (auto-dispatch) |

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
      AdminDashboard.jsx         Live feed + simulator + predict panel
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

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | for live mode | Gemini 2.5-Flash + Embeddings + Vision |
| `GOOGLE_CHAT_WEBHOOK_URL` | optional | Auto-dispatch alert cards |
| `ENABLE_GROUNDING` | optional | `false` (default) gates Google Search grounding to save Free-Tier quota |

---

## License

MIT (or specify before publishing).
