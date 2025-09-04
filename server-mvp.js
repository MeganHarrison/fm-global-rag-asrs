#!/usr/bin/env tsx
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Simple Express server for MVP - run with: npx tsx server-mvp.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const chat_handler_mvp_1 = require("./chat-handler-mvp");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve static files from public directory
app.use(express_1.default.static(path_1.default.join(__dirname, 'public')));
// Initialize agent
const agent = new chat_handler_mvp_1.SimpleFMGlobalAgent(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, process.env.OPENAI_API_KEY);
// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'FM Global RAG Agent MVP',
        endpoints: ['/chat', '/design']
    });
});
// Chat endpoint
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        console.log(`Processing: ${message}`);
        const response = await agent.handleChatMessage(message);
        res.json({ response });
    }
    catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Chat processing failed' });
    }
});
// Design endpoint
app.post('/design', async (req, res) => {
    try {
        const config = req.body;
        if (!config.asrs_type || !config.container_type) {
            return res.status(400).json({ error: 'ASRS type and container type are required' });
        }
        const design = await agent.generateDesign(config);
        res.json({ design });
    }
    catch (error) {
        console.error('Design error:', error);
        res.status(500).json({ error: 'Design generation failed' });
    }
});
app.listen(PORT, () => {
    console.log(`
🚀 FM Global RAG Agent MVP Server
==================================
Running at: http://localhost:${PORT}

Test with:
curl -X POST http://localhost:${PORT}/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message": "What are ASRS sprinkler requirements?"}'
  `);
});
