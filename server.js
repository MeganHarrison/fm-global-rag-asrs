const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'FM Global RAG Agent is running', timestamp: new Date().toISOString() });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Import the chat handler  
    const { SimpleFMGlobalAgent } = require('./chat-handler-mvp.js');
    
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
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`Chat endpoint: POST http://localhost:${PORT}/chat`);
});