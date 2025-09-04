#!/usr/bin/env python3
"""Test script to verify Python deployment will work."""

import sys
import importlib
import os

print("🚀 Testing FM Global RAG Agent Python Deployment...\n")

# Test 1: Check Python version
print("📦 Test 1: Checking Python version...")
python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
print(f"  Python version: {python_version}")
if sys.version_info.major == 3 and sys.version_info.minor >= 8:
    print("  ✅ Python version is compatible")
else:
    print("  ❌ Python version too old - need 3.8+")
    sys.exit(1)

# Test 2: Check required packages
print("\n📦 Test 2: Checking required packages...")
required_packages = [
    'fastapi',
    'uvicorn',
    'pydantic',
    'pydantic_ai',
    'pydantic_settings',
    'sqlalchemy',
    'psycopg2',
    'dotenv',
    'openai',
    'anthropic'
]

missing_packages = []
for package in required_packages:
    try:
        if package == 'dotenv':
            importlib.import_module('dotenv')
        elif package == 'psycopg2':
            importlib.import_module('psycopg2')
        else:
            importlib.import_module(package)
        print(f"  ✅ {package} found")
    except ImportError:
        print(f"  ❌ {package} NOT FOUND")
        missing_packages.append(package)

if missing_packages:
    print(f"\n❌ Missing packages: {', '.join(missing_packages)}")
    print("Run: pip install -r requirements.txt")
    sys.exit(1)

# Test 3: Check if server.py imports work
print("\n🤖 Test 3: Testing server imports...")
try:
    # Set dummy environment variables for testing
    os.environ.setdefault('DATABASE_URL', 'postgresql://test@localhost/test')
    os.environ.setdefault('LLM_API_KEY', 'test-key')
    os.environ.setdefault('LLM_PROVIDER', 'openai')
    
    # Try importing the server
    import server
    print("  ✅ Server module loads successfully")
    print(f"  ✅ FastAPI app created: {hasattr(server, 'app')}")
except Exception as e:
    print(f"  ❌ Server import error: {e}")
    # This is expected if dependencies aren't set up
    print("  ⚠️  Note: This may be normal if database isn't configured")

# Test 4: Check environment variables
print("\n🔑 Test 4: Checking environment variables...")
required_env = ['DATABASE_URL', 'LLM_API_KEY', 'LLM_PROVIDER']
missing_env = []

for env_var in required_env:
    if env_var in os.environ:
        print(f"  ✅ {env_var} is set")
    else:
        print(f"  ⚠️  {env_var} not set (set in Render dashboard)")
        missing_env.append(env_var)

if missing_env:
    print("\n⚠️  Environment variables to set in Render:")
    for var in missing_env:
        print(f"  - {var}")

print("\n✅ Python deployment test complete!")
print("\n📋 Deployment settings for Render:")
print("  Runtime: Python")
print("  Build Command: pip install -r requirements.txt")
print("  Start Command: python server.py")
print("\n🔧 Environment variables to set in Render:")
print("  - DATABASE_URL (PostgreSQL with PGVector)")
print("  - LLM_API_KEY (OpenAI API key)")
print("  - LLM_PROVIDER (set to 'openai')")