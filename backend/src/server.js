require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/apiRoutes');
const http = require('http');
const { Server } = require('socket.io');
const { initializeKnowledgeBase } = require('./services/ragService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api', apiRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.locals.io = io; // Injecting io instance globally so route controllers can emit events

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

server.listen(PORT, async () => {
    console.log(`Server (with WebSockets) running on http://localhost:${PORT}`);
    await initializeKnowledgeBase();
});
