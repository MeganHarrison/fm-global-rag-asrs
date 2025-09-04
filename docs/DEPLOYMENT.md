# Deployment Options for FM Global ASRS RAG Agent

## Current Architecture Analysis

Your Express.js/Node.js application **cannot** be deployed directly to Cloudflare Workers because:

1. **Runtime Incompatibility**: Cloudflare Workers uses the Workers runtime (V8 isolates), not Node.js
2. **Express.js**: Workers don't support Express - they use the Fetch API
3. **File System**: No `fs` module or file system access in Workers
4. **Long-running Operations**: Workers have 30-second CPU time limits (10ms for free tier)
5. **Dependencies**: Many Node.js packages don't work in Workers environment

## Deployment Options

### Option 1: Render (Recommended for MVP)
**Best for: Quick deployment, minimal changes needed**

```yaml
# render.yaml
services:
  - type: web
    name: fm-global-rag
    env: node
    buildCommand: npm install
    startCommand: npm run start
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
      - key: OPENAI_API_KEY
        sync: false
```

Deploy with: Push to GitHub and connect to Render

### Option 2: Railway
**Similar to Render, one-click deploy**

```json
{
  "build": {
    "builder": "nixpacks"
  },
  "deploy": {
    "startCommand": "npm run start"
  }
}
```

### Option 3: Vercel (Requires Adaptation)
Convert to Next.js API routes or Vercel Functions:

```typescript
// api/chat.ts
export default async function handler(req, res) {
  // Your chat logic here
}
```

### Option 4: Cloudflare Workers (Requires Full Rewrite)

If you specifically want Cloudflare Workers, the app needs rewriting:

```typescript
// worker.ts - Cloudflare Workers version
import { Hono } from 'hono';

const app = new Hono();

app.post('/chat', async (c) => {
  const { message } = await c.req.json();
  
  // Use D1 instead of Supabase
  const db = c.env.DB;
  
  // Use Cloudflare AI instead of OpenAI
  const embedding = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: message
  });
  
  // Vector search would need Vectorize or custom solution
  return c.json({ response: "..." });
});

export default app;
```

**Major Changes Required:**
- Replace Supabase with Cloudflare D1 + Vectorize
- Replace OpenAI with Cloudflare AI or use API via fetch
- Rewrite all Express routes to Workers format
- Handle vector search differently

## Quick Deployment Instructions

### For Render (Easiest):
1. Push code to GitHub
2. Go to render.com
3. New > Web Service > Connect GitHub repo
4. Add environment variables
5. Deploy

### For Railway:
1. Push code to GitHub  
2. Go to railway.app
3. New Project > Deploy from GitHub
4. Add environment variables
5. Deploy

### For Cloudflare Pages + Functions (Hybrid):
Keep current backend on Render/Railway, deploy frontend to Cloudflare Pages:

```bash
# Deploy just the frontend
npx wrangler pages deploy public/ --project-name fm-global-chat
```

Then update frontend to use your Render backend URL.

## Recommendation

**For MVP: Use Render or Railway** - Your current code works as-is, deploys in minutes.

**For Production: Consider migrating to Cloudflare Workers** if you need:
- Global edge deployment
- Lower latency
- Better scaling
- Lower costs at scale

But this requires significant code changes.