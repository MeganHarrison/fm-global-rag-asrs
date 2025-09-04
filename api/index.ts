// Simple Express API for FM Global RAG Chat MVP
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { FMGlobal834Agent, type ASRSConfiguration, type ChatMessage } from '../chat-form-handler';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize the agent
const agent = new FMGlobal834Agent(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  process.env.OPENAI_API_KEY!
);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'FM Global RAG Agent' });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`Processing chat message: ${message}`);
    const response = await agent.handleChatMessage(message, history);
    
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Design generation endpoint
app.post('/api/design', async (req, res) => {
  try {
    const configuration: ASRSConfiguration = req.body;
    
    console.log('Generating design for configuration:', configuration);
    const design = await agent.handleFormSubmission(configuration);
    
    res.json({ design, lead_score: 85 }); // Mock lead score for MVP
  } catch (error) {
    console.error('Design generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate design',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Validate configuration endpoint
app.post('/api/validate', async (req, res) => {
  try {
    const configuration = req.body;
    
    // Simple validation for MVP
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!configuration.asrs_type) errors.push('ASRS type is required');
    if (!configuration.container_type) errors.push('Container type is required');
    if (configuration.rack_depth_ft && configuration.rack_depth_ft < 3) {
      errors.push('Rack depth must be at least 3 feet');
    }
    
    res.json({
      valid: errors.length === 0,
      errors,
      warnings
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Validation failed' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 FM Global RAG Agent API running on http://localhost:${PORT}`);
  console.log(`
  Available endpoints:
  - GET  /health           - Health check
  - POST /api/chat         - Chat with the agent
  - POST /api/design       - Generate design from configuration
  - POST /api/validate     - Validate configuration
  `);
});