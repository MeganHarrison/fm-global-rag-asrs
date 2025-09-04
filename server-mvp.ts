#!/usr/bin/env tsx
// Simple Express server for MVP - run with: npx tsx server-mvp.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import { SimpleFMGlobalAgent } from './chat-handler-mvp';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize agent
const agent = new SimpleFMGlobalAgent(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  process.env.OPENAI_API_KEY!
);

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
  } catch (error) {
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
  } catch (error) {
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