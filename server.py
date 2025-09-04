#!/usr/bin/env python3
"""FastAPI server for FM Global RAG Agent."""

import os
import logging
from typing import Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from agent import search_agent
from dependencies import AgentDependencies
from settings import load_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Request/Response models
class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None

class ChatResponse(BaseModel):
    role: str = "assistant"
    content: str
    timestamp: str

class HealthResponse(BaseModel):
    status: str
    timestamp: str

# Global dependencies
deps = None
settings = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan."""
    global deps, settings
    logger.info("Starting FM Global RAG Agent API...")
    
    # Initialize dependencies
    try:
        settings = load_settings()
        deps = AgentDependencies()
        deps.settings = settings
        await deps.initialize()
        logger.info("Dependencies initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize dependencies: {e}")
        deps = None
    
    yield
    
    # Cleanup on shutdown
    if deps:
        await deps.cleanup()
    logger.info("Shut down FM Global RAG Agent API")

# Create FastAPI app
app = FastAPI(
    title="FM Global RAG Agent API",
    version="1.0.0",
    description="API for FM Global 8-34 ASRS RAG Agent",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    from datetime import datetime
    return HealthResponse(
        status="FM Global RAG Agent is running",
        timestamp=datetime.utcnow().isoformat()
    )

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Process chat messages."""
    if not deps:
        raise HTTPException(
            status_code=503,
            detail="Service unavailable - dependencies not initialized"
        )
    
    try:
        logger.info(f"Processing chat message: {request.message[:100]}...")
        
        # Build prompt with context if provided
        prompt = request.message
        if request.context:
            prompt = f"Context: {request.context}\n\nUser: {request.message}"
        
        # Run the agent
        response = await search_agent.run(prompt, deps=deps)
        
        from datetime import datetime
        return ChatResponse(
            content=response.data,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Chat processing error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing chat: {str(e)}"
        )

@app.get("/status")
async def status():
    """Get detailed status information."""
    return {
        "status": "operational" if deps else "degraded",
        "version": "1.0.0",
        "dependencies": {
            "agent": "initialized" if deps else "not initialized",
            "database": "connected" if deps else "not connected"
        }
    }

if __name__ == "__main__":
    # Get port from environment or default to 4000
    port = int(os.environ.get("PORT", 4000))
    
    # Run the server
    logger.info(f"Starting server on port {port}")
    uvicorn.run(
        "server:app",
        host="0.0.0.0",  # Required for Render
        port=port,
        reload=False,  # Set to False in production
        log_level="info"
    )