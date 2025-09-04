# Using FM Global RAG Agent in Next.js

## Available Endpoints

Your MVP server running on `http://localhost:4000` provides:

### 1. Chat Endpoint
```
POST http://localhost:4000/chat
Content-Type: application/json

Body:
{
  "message": "What are ASRS sprinkler requirements?"
}

Response:
{
  "response": {
    "role": "assistant",
    "content": "...",
    "timestamp": "2024-..."
  }
}
```

### 2. Design Endpoint
```
POST http://localhost:4000/design
Content-Type: application/json

Body:
{
  "asrs_type": "single-deep",
  "container_type": "plastic",
  "storage_height": 30,
  "commodity_class": "III"
}

Response:
{
  "design": {
    "sprinkler_density": "...",
    "water_supply_requirements": "...",
    "special_considerations": ["..."]
  }
}
```

## Next.js Integration Options

### Option 1: Direct API Calls from Client Components

```typescript
// app/components/ChatComponent.tsx
'use client';

import { useState } from 'react';

export function ChatComponent() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');

  const sendMessage = async () => {
    const res = await fetch('http://localhost:4000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    setResponse(data.response.content);
  };

  return (
    <div>
      <input 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask about ASRS requirements..."
      />
      <button onClick={sendMessage}>Send</button>
      <div>{response}</div>
    </div>
  );
}
```

### Option 2: API Route Proxy (Recommended)

Create a Next.js API route that proxies to your Express server:

```typescript
// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${AGENT_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
```

Then use it in your component:

```typescript
// app/components/ChatComponent.tsx
'use client';

const sendMessage = async () => {
  const res = await fetch('/api/chat', {  // Uses your Next.js API route
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  const data = await res.json();
  setResponse(data.response.content);
};
```

### Option 3: Server Actions (App Router)

```typescript
// app/actions/chat.ts
'use server';

export async function sendChatMessage(message: string) {
  const response = await fetch('http://localhost:4000/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  
  const data = await response.json();
  return data.response;
}
```

Use in component:

```typescript
// app/components/ChatForm.tsx
import { sendChatMessage } from '@/app/actions/chat';

export function ChatForm() {
  async function handleSubmit(formData: FormData) {
    const message = formData.get('message') as string;
    const response = await sendChatMessage(message);
    // Handle response
  }

  return (
    <form action={handleSubmit}>
      <input name="message" />
      <button type="submit">Send</button>
    </form>
  );
}
```

## Environment Variables

Add to your Next.js `.env.local`:

```bash
# If using different port or deploying
AGENT_URL=http://localhost:4000
```

## Running Both Services

1. Start the RAG agent server:
```bash
cd agents/rag_agent_asrs
npm run start  # Runs on port 4000
```

2. Start your Next.js app:
```bash
cd your-nextjs-app
npm run dev  # Runs on port 3000
```

## Example: Full Integration

Here's a complete example using the chat endpoint in a Next.js component:

```typescript
// app/fm-global-chat/page.tsx
'use client';

import { useState } from 'react';

export default function FMGlobalChat() {
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:4000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });

      const data = await response.json();
      setMessages(prev => [...prev, data.response]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1>FM Global ASRS Expert</h1>
      
      <div className="space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`p-3 rounded ${
            msg.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            {msg.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 p-2 border rounded"
          placeholder="Ask about ASRS requirements..."
          disabled={loading}
        />
        <button 
          type="submit" 
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
```

## Testing the Integration

```bash
# Test from command line
curl -X POST http://localhost:4000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What are ASRS requirements?"}'
```

## CORS Configuration

The Express server already has CORS enabled for all origins. If you need to restrict it:

```typescript
// In server-mvp.ts
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
```