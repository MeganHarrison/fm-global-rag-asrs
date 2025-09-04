// End-to-end test of the chat endpoint
const http = require('http');

const testMessage = {
  message: "What are ASRS sprinkler requirements?"
};

const postData = JSON.stringify(testMessage);

const options = {
  hostname: 'localhost',
  port: 8888,
  path: '/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 Testing chat endpoint...\n');
console.log('Starting server on port 8888...');

// Start the server
const { spawn } = require('child_process');
const server = spawn('node', ['server.js'], {
  env: { ...process.env, PORT: '8888' }
});

// Wait for server to start
setTimeout(() => {
  const req = http.request(options, (res) => {
    console.log(`\n📊 Response Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('\n✅ Chat endpoint works!');
        console.log('Response structure:', Object.keys(response));
        
        if (response.error) {
          console.log('⚠️  API returned error:', response.error);
          if (response.details) {
            console.log('Details:', response.details);
          }
        } else {
          console.log('✅ Successfully received response from chat API');
        }
      } catch (e) {
        console.log('❌ Failed to parse response:', e.message);
        console.log('Raw response:', data.substring(0, 200));
      }
      
      // Kill the server
      server.kill();
      process.exit(0);
    });
  });
  
  req.on('error', (e) => {
    console.error(`❌ Request failed: ${e.message}`);
    server.kill();
    process.exit(1);
  });
  
  req.write(postData);
  req.end();
}, 2000);

server.stdout.on('data', (data) => {
  console.log(`Server: ${data}`);
});

server.stderr.on('data', (data) => {
  console.error(`Server Error: ${data}`);
});