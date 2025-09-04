# FM Global RAG Chat MVP - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Create a `.env` file with your credentials:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
PORT=3001
```

### 3. Test the Chat (No Server Needed)
```bash
npm run test
```
This will run test queries directly against the agent without starting a server.

### 4. Start the API Server (Optional)
```bash
npm run dev
```
The API will be available at `http://localhost:3001`

## 📝 Test the Chat API

### Using cURL:
```bash
# Simple chat query
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What sprinkler spacing do I need for a shuttle ASRS?"
  }'

# Design generation
curl -X POST http://localhost:3001/api/design \
  -H "Content-Type: application/json" \
  -d '{
    "asrs_type": "Shuttle",
    "container_type": "Closed-Top",
    "rack_depth_ft": 20,
    "rack_spacing_ft": 4,
    "ceiling_height_ft": 32,
    "aisle_width_ft": 8,
    "commodity_type": ["Class II Commodities"],
    "storage_height_ft": 28,
    "system_type": "wet"
  }'
```

### Using JavaScript/React:
```javascript
// Chat example
const response = await fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "What are the requirements for mini-load ASRS?"
  })
});
const data = await response.json();
console.log(data.response.content);

// Or use the React hooks (react-hooks.ts)
import { useChat } from './react-hooks';

function ChatComponent() {
  const { messages, sendMessage, isLoading } = useChat();
  
  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputValue);
  };
  
  return (
    <div>
      {messages.map(msg => (
        <div key={msg.timestamp}>{msg.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Ask about ASRS sprinklers..." />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

## 🧪 What's Working in the MVP

✅ **Chat Interface** - Ask natural language questions about ASRS sprinkler requirements
✅ **Design Generation** - Generate complete sprinkler designs from configuration
✅ **Cost Estimation** - Get equipment and labor cost breakdowns
✅ **Optimization Suggestions** - Receive cost-saving recommendations
✅ **Validation** - Check if configurations meet FM Global requirements

## 📊 Example Questions to Try

1. "What are the sprinkler spacing requirements for a shuttle ASRS?"
2. "How do I protect open-top containers in a mini-load system?"
3. "What's the difference between wet and dry sprinkler systems?"
4. "Calculate sprinklers needed for a 20ft deep rack"
5. "What are the FM Global requirements for plastic commodities?"

## 🗄️ Database Setup (If Needed)

The system expects these PostgreSQL tables with pgvector:
- `fm_global_figures` - Diagrams and figures
- `fm_global_tables` - Design parameter tables  
- `fm_table_vectors` - Vectorized table content
- `fm_text_chunks` - Regulatory text chunks
- `fm_cost_factors` - Cost calculation factors

For testing, you can mock these or use the existing `documents` and `chunks` tables.

## 🐛 Troubleshooting

### "Cannot connect to Supabase"
- Check your SUPABASE_URL and SUPABASE_ANON_KEY in .env
- Ensure the tables exist in your database

### "OpenAI API error"
- Verify your OPENAI_API_KEY is valid
- Check you have credits in your OpenAI account

### "Module not found"
- Run `npm install` to install all dependencies
- Ensure you're using Node.js 18 or higher

## 🎯 Next Steps

1. **Add a Frontend**: Use the React hooks in a Next.js app
2. **Populate Database**: Add FM Global content to the vector tables
3. **Enhance Search**: Improve vector similarity search with better embeddings
4. **Add Authentication**: Secure the API endpoints
5. **Deploy**: Host on Vercel, Railway, or AWS

## 💡 MVP Limitations

- No authentication (add before production)
- Mock data for some responses
- Basic error handling
- No rate limiting
- No caching

Start with `npm run test` to see it working immediately!