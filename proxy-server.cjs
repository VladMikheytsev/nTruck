const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3002;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Trak-4 API proxy endpoint
app.post('/api/trak4/device', async (req, res) => {
  try {
    console.log('📡 Proxy: Received request for Trak-4 device data');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    
    const { APIKey, DeviceID } = req.body;
    
    if (!APIKey || !DeviceID) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'APIKey and DeviceID are required'
      });
    }
    
    console.log('🔗 Forwarding request to Trak-4 API...');
    
    // Forward request to Trak-4 API
    const trak4Response = await fetch('https://api-v3.trak-4.com/device', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NTruck-GPS-Proxy/1.0'
      },
      body: JSON.stringify({
        APIKey: APIKey,
        DeviceID: DeviceID
      })
    });
    
    console.log('📡 Trak-4 API Response Status:', trak4Response.status, trak4Response.statusText);
    
    if (!trak4Response.ok) {
      const errorText = await trak4Response.text();
      console.error('❌ Trak-4 API Error:', errorText);
      
      return res.status(trak4Response.status).json({
        error: 'Trak-4 API Error',
        status: trak4Response.status,
        statusText: trak4Response.statusText,
        details: errorText
      });
    }
    
    const data = await trak4Response.json();
    console.log('✅ Trak-4 API Success - Device data received');
    console.log('📊 Response data:', JSON.stringify(data, null, 2));
    
    // Forward the response back to the client
    res.json(data);
    
  } catch (error) {
    console.error('❌ Proxy server error:', error);
    res.status(500).json({
      error: 'Proxy server error',
      message: error.message,
      details: error.toString()
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Trak-4 GPS Proxy Server is running',
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(PORT, () => {
  console.log('🚀 Trak-4 GPS Proxy Server started');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log('🔗 Proxy endpoint: POST /api/trak4/device');
  console.log('❤️ Health check: GET /health');
  console.log('');
  console.log('📋 Usage:');
  console.log(`POST http://localhost:${PORT}/api/trak4/device`);
  console.log('Body: { "APIKey": "your-key", "DeviceID": 123456 }');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Trak-4 GPS Proxy Server...');
  process.exit(0);
});
