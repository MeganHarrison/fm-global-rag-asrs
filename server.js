const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import chat handler at startup to catch any module errors early
const { SimpleFMGlobalAgent } = require('./chat-handler-mvp.js');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'FM Global RAG Agent is running', 
    timestamp: new Date().toISOString(),
    environment: {
      node_version: process.version,
      port: PORT,
      has_supabase_url: !!process.env.SUPABASE_URL,
      has_supabase_key: !!process.env.SUPABASE_SERVICE_KEY,
      has_openai_key: !!process.env.OPENAI_API_KEY
    }
  });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Missing required environment variables'
      });
    }
    
    // Initialize agent with environment variables
    const agent = new SimpleFMGlobalAgent(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      process.env.OPENAI_API_KEY
    );
    
    // Process the chat
    const response = await agent.handleChatMessage(message);
    
    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred processing your request'
    });
  }
});

// Start server with proper error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`FM Global RAG Agent Server Started`);
  console.log(`Port: ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`Chat endpoint: POST http://localhost:${PORT}/chat`);
  console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});