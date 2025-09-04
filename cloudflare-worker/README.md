# Cloudflare Workers Deployment

This is a complete rewrite of the FM Global RAG Agent for Cloudflare Workers.

## Setup Instructions

1. **Install Wrangler CLI:**
```bash
npm install -g wrangler
wrangler login
```

2. **Create D1 Database:**
```bash
wrangler d1 create fm-global-rag
# Copy the database_id from output to wrangler.toml
```

3. **Create KV Namespace:**
```bash
wrangler kv:namespace create "CACHE"
# Copy the id from output to wrangler.toml
```

4. **Install Dependencies:**
```bash
cd cloudflare-worker
npm install
```

5. **Run Migrations:**
```bash
npm run migrate
```

6. **Set Secrets:**
```bash
wrangler secret put OPENAI_API_KEY
# Enter your OpenAI API key when prompted
```

7. **Deploy:**
```bash
npm run deploy
```

## Local Development

```bash
npm run dev
# Visit http://localhost:8787
```

## Architecture Differences

### What Changed:
- **Database**: Supabase PostgreSQL → Cloudflare D1 (SQLite)
- **Vector Search**: pgvector → Cloudflare AI embeddings + custom similarity
- **Runtime**: Node.js/Express → Workers Runtime (V8 isolates)
- **File Storage**: None needed (all in D1)
- **Caching**: Added KV namespace for performance

### Limitations:
- No native vector database (yet - Vectorize is in beta)
- 10MB request/response size limit
- 30-second CPU time limit (10ms on free tier)
- No file system access
- Limited npm package compatibility

### Benefits:
- Global edge deployment (200+ locations)
- Zero cold starts
- Automatic scaling
- Lower latency
- Cost-effective at scale

## Migration Path

To migrate existing data:

1. Export from Supabase:
```sql
COPY fm_text_chunks TO '/tmp/chunks.csv' CSV HEADER;
```

2. Transform for D1:
```javascript
// Convert pgvector embeddings to JSON arrays
const embedding = JSON.stringify(Array.from(pgvectorEmbedding));
```

3. Import to D1:
```bash
wrangler d1 execute fm-global-rag --file=import.sql
```

## API Endpoints

Same as Express version:
- `GET /` - Health check
- `POST /chat` - Chat with context
- `POST /design` - Generate design specs
- `POST /search` - Vector similarity search

## Cost Comparison

### Cloudflare Workers (per month):
- Workers: $5 (10M requests included)
- D1: $5 (10GB storage, 50M reads)
- KV: $5 (10M reads, 1M writes)
- **Total: ~$15/month**

### Traditional Hosting:
- Render/Railway: $7-20/month
- Supabase: $25/month
- **Total: ~$32-45/month**

## When to Use This Version

Choose Cloudflare Workers if you need:
- Global distribution
- Minimal latency
- Automatic scaling
- Lower costs at scale

Stay with Express/Node.js if you need:
- Complex vector operations (pgvector)
- Large file processing
- Long-running operations
- Full Node.js ecosystem