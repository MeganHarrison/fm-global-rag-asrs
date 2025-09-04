/**
 * Cloudflare Workers version of FM Global ASRS RAG Agent
 * This is a complete rewrite for Workers runtime
 * 
 * Note: This requires significant infrastructure changes:
 * - Migrate from Supabase to Cloudflare D1 for database
 * - Use Cloudflare Vectorize or custom vector solution
 * - Use Cloudflare AI or OpenAI via fetch
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Env = {
  // D1 database binding
  DB: D1Database;
  // KV namespace for caching
  CACHE: KVNamespace;
  // Environment variables
  OPENAI_API_KEY: string;
  // Vectorize index (when available)
  VECTOR_INDEX?: any;
  // AI binding for embeddings
  AI: any;
};

const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use('/*', cors());

// Health check
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'FM Global RAG Agent - Cloudflare Workers',
    endpoints: ['/chat', '/design', '/search']
  });
});

// Vector similarity search using Cloudflare AI
async function searchSimilarDocuments(c: any, query: string, limit = 5) {
  // Generate embedding using Cloudflare AI
  const embedding = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [query]
  });

  // If Vectorize is available, use it
  if (c.env.VECTOR_INDEX) {
    const results = await c.env.VECTOR_INDEX.query(embedding.data[0], {
      topK: limit,
      returnMetadata: true
    });
    return results.matches;
  }

  // Fallback: Use D1 with cosine similarity calculation
  // Note: This is less efficient than pgvector but works in Workers
  const embeddingStr = JSON.stringify(embedding.data[0]);
  
  // Simplified cosine similarity in SQL (requires custom D1 setup)
  const results = await c.env.DB.prepare(`
    SELECT 
      content,
      metadata,
      1 - (
        SELECT SUM(a.value * b.value) / 
        (SQRT(SUM(a.value * a.value)) * SQRT(SUM(b.value * b.value)))
        FROM json_each(embedding) a
        JOIN json_each(?) b ON a.key = b.key
      ) as similarity
    FROM fm_documents
    ORDER BY similarity DESC
    LIMIT ?
  `).bind(embeddingStr, limit).all();

  return results.results || [];
}

// Chat endpoint
app.post('/chat', async (c) => {
  try {
    const { message } = await c.req.json();
    
    if (!message) {
      return c.json({ error: 'Message is required' }, 400);
    }

    // Search for relevant documents
    const relevantDocs = await searchSimilarDocuments(c, message, 5);
    
    // Prepare context from search results
    const context = relevantDocs
      .map(doc => doc.content)
      .join('\n\n');

    // Call OpenAI API using fetch
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert on FM Global Property Loss Prevention Data Sheet 8-34 for ASRS.
            Use the following context to answer questions: ${context}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data = await openaiResponse.json();
    
    return c.json({
      response: {
        role: 'assistant',
        content: data.choices[0].message.content,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ error: 'Chat processing failed' }, 500);
  }
});

// Design endpoint
app.post('/design', async (c) => {
  try {
    const config = await c.req.json();
    
    if (!config.asrs_type || !config.container_type) {
      return c.json({ 
        error: 'ASRS type and container type are required' 
      }, 400);
    }

    // Query design parameters from D1
    const designParams = await c.env.DB.prepare(`
      SELECT * FROM fm_design_parameters
      WHERE asrs_type = ? AND container_type = ?
    `).bind(config.asrs_type, config.container_type).first();

    // Generate design recommendations
    const design = {
      asrs_type: config.asrs_type,
      container_type: config.container_type,
      sprinkler_requirements: {
        ceiling: designParams?.ceiling_protection || 'ESFR K-25.2',
        in_rack: designParams?.in_rack_protection || 'Required for Class I-IV',
        design_pressure: designParams?.design_pressure || '75 psi minimum'
      },
      generated_at: new Date().toISOString()
    };

    // Cache the result
    await c.env.CACHE.put(
      `design:${config.asrs_type}:${config.container_type}`,
      JSON.stringify(design),
      { expirationTtl: 3600 } // 1 hour cache
    );

    return c.json({ design });
  } catch (error) {
    console.error('Design error:', error);
    return c.json({ error: 'Design generation failed' }, 500);
  }
});

// Search endpoint (simpler vector search)
app.post('/search', async (c) => {
  try {
    const { query, limit = 10 } = await c.req.json();
    
    if (!query) {
      return c.json({ error: 'Query is required' }, 400);
    }

    // Check cache first
    const cacheKey = `search:${query}:${limit}`;
    const cached = await c.env.CACHE.get(cacheKey);
    if (cached) {
      return c.json({ results: JSON.parse(cached), cached: true });
    }

    const results = await searchSimilarDocuments(c, query, limit);
    
    // Cache results
    await c.env.CACHE.put(
      cacheKey,
      JSON.stringify(results),
      { expirationTtl: 300 } // 5 minute cache
    );

    return c.json({ results, cached: false });
  } catch (error) {
    console.error('Search error:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

export default app;