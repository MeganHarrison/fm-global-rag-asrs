# FM Global RAG ASRS Agent - Render Deployment Guide

## Pre-Deployment Checklist

✅ **All issues have been fixed:**
- Server properly configured for production deployment
- TypeScript files compiled to JavaScript
- Port binding uses `process.env.PORT`
- All dependencies properly declared
- Error handling and graceful shutdown implemented

## Repository Setup

1. **Ensure your repository is up to date:**
```bash
git add .
git commit -m "Production-ready deployment configuration"
git push origin main
```

## Render Deployment Instructions

### Step 1: Create New Web Service

1. Log into Render Dashboard (https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository: `https://github.com/MeganHarrison/fm-global-rag-asrs.git`
4. Select the repository when prompted

### Step 2: Configure Build Settings

Configure your service with these EXACT settings:

| Setting | Value |
|---------|--------|
| **Name** | `fm-global-rag-asrs` |
| **Environment** | `Node` |
| **Region** | Choose closest to your users |
| **Branch** | `main` |
| **Root Directory** | *(leave blank - use repo root)* |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

### Step 3: Environment Variables

Click "Advanced" and add these environment variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase service role key |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `NODE_ENV` | Set to `production` |

### Step 4: Select Instance Type

- For testing: **Free** tier
- For production: **Starter** ($7/month) or higher

### Step 5: Deploy

1. Click "Create Web Service"
2. Wait for the build to complete (3-5 minutes)
3. Check the logs for:
   ```
   FM Global RAG Agent Server Started
   Port: [PORT]
   Health check: http://localhost:[PORT]/
   Chat endpoint: POST http://localhost:[PORT]/chat
   Environment: production
   ```

## Post-Deployment Testing

### 1. Test Health Check
```bash
curl https://fm-global-rag-asrs.onrender.com/
```

Expected response:
```json
{
  "status": "FM Global RAG Agent is running",
  "timestamp": "2025-09-04T...",
  "environment": {
    "node_version": "v18.x.x",
    "port": "10000",
    "has_supabase_url": true,
    "has_supabase_key": true,
    "has_openai_key": true
  }
}
```

### 2. Test Chat Endpoint
```bash
curl -X POST https://fm-global-rag-asrs.onrender.com/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What are the sprinkler requirements for a shuttle ASRS?"}'
```

Expected: JSON response with assistant's answer

## Troubleshooting

### If deployment fails:

1. **Check Build Logs**
   - Look for `npm install` errors
   - Verify all dependencies are installed

2. **Check Runtime Logs**
   - Look for "Server Started" message
   - Check for environment variable warnings

3. **Common Issues & Solutions**

| Issue | Solution |
|-------|----------|
| "Cannot find module" | Ensure `npm install` runs in build command |
| "Port already in use" | Use `process.env.PORT` (already fixed) |
| "Missing environment variables" | Double-check all 3 env vars are set |
| "Connection timeout" | Check Supabase/OpenAI API keys are valid |

### Quick Diagnostic Script

Run this locally to verify everything before deployment:
```bash
npm test
```

All tests should pass with green checkmarks.

## File Structure Confirmation

Your deployment includes these critical files:
- `server.js` - Main Express server (production-ready)
- `chat-handler-mvp.js` - Compiled chat handler
- `package.json` - Proper dependencies and scripts
- `.env` - Local only (not deployed)

## Support

If issues persist after following this guide:
1. Check Render status page: https://status.render.com
2. Review logs in Render dashboard
3. Ensure GitHub repository is properly synced

## Success Indicators

✅ Health check returns 200 status  
✅ All environment checks show `true`  
✅ Chat endpoint processes messages  
✅ No errors in Render logs  
✅ Service stays "Live" in Render dashboard

---

**Last Updated:** September 4, 2025  
**Tested With:** Node 18+, Render Web Service