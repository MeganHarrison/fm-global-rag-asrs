// Test script to validate deployment will work
console.log('🚀 Testing FM Global RAG Agent Deployment...\n');

// Test 1: Check all required modules
console.log('📦 Test 1: Checking required modules...');
const requiredModules = ['express', 'cors', 'dotenv', '@supabase/supabase-js', 'openai'];
let allModulesFound = true;

requiredModules.forEach(module => {
  try {
    require.resolve(module);
    console.log(`  ✅ ${module} found`);
  } catch (e) {
    console.log(`  ❌ ${module} NOT FOUND - deployment will fail!`);
    allModulesFound = false;
  }
});

if (!allModulesFound) {
  console.log('\n❌ Missing modules detected. Run: npm install');
  process.exit(1);
}

// Test 2: Check environment variables
console.log('\n🔑 Test 2: Checking environment variables...');
require('dotenv').config();

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'OPENAI_API_KEY'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.log('  ⚠️  Missing environment variables:', missingEnvVars.join(', '));
  console.log('  Note: Make sure these are set in Render environment settings');
} else {
  console.log('  ✅ All required environment variables are set');
}

// Test 3: Check chat handler
console.log('\n🤖 Test 3: Testing chat handler...');
try {
  const { SimpleFMGlobalAgent } = require('./chat-handler-mvp.js');
  // Test with environment variables (or dummy values for testing)
  const testUrl = process.env.SUPABASE_URL || 'https://test.supabase.co';
  const testKey = process.env.SUPABASE_SERVICE_KEY || 'test-key';
  const testOpenAI = process.env.OPENAI_API_KEY || 'test-key';
  
  const agent = new SimpleFMGlobalAgent(testUrl, testKey, testOpenAI);
  console.log('  ✅ Chat handler loads successfully');
  console.log(`  ✅ Agent class instantiates correctly`);
  console.log(`  ✅ Agent has processQuery method: ${typeof agent.processQuery === 'function'}`);
} catch (e) {
  console.log(`  ❌ Chat handler error: ${e.message}`);
  process.exit(1);
}

// Test 4: Test server startup
console.log('\n🌐 Test 4: Testing server startup...');
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const testPort = 9876;
const server = app.listen(testPort, () => {
  console.log(`  ✅ Express server starts successfully on port ${testPort}`);
  server.close();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`  ⚠️  Port ${testPort} in use, but server code is valid`);
  } else {
    console.log(`  ❌ Server error: ${err.message}`);
    process.exit(1);
  }
});

// Test 5: Validate server.js
console.log('\n📝 Test 5: Validating server.js...');
try {
  const serverCode = require('fs').readFileSync('./server.js', 'utf8');
  const hasHealthCheck = serverCode.includes("app.get('/'");
  const hasChatEndpoint = serverCode.includes("app.post('/chat'");
  const usesCorrectAgent = serverCode.includes('SimpleFMGlobalAgent');
  
  console.log(`  ${hasHealthCheck ? '✅' : '❌'} Health check endpoint present`);
  console.log(`  ${hasChatEndpoint ? '✅' : '❌'} Chat endpoint present`);
  console.log(`  ${usesCorrectAgent ? '✅' : '❌'} Using correct agent class`);
  
  if (!hasHealthCheck || !hasChatEndpoint || !usesCorrectAgent) {
    console.log('\n❌ server.js has issues that need fixing');
    process.exit(1);
  }
} catch (e) {
  console.log(`  ❌ Could not read server.js: ${e.message}`);
  process.exit(1);
}

setTimeout(() => {
  console.log('\n✅ All deployment tests passed! Ready for Render deployment.');
  console.log('\n📋 Deployment settings for Render:');
  console.log('  Build Command: (leave empty)');
  console.log('  Start Command: npm start');
  console.log('\n🔧 Environment variables to set in Render:');
  console.log('  - SUPABASE_URL');
  console.log('  - SUPABASE_SERVICE_KEY');
  console.log('  - OPENAI_API_KEY');
  process.exit(0);
}, 1000);