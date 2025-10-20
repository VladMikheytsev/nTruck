const express = require('express');
const cors = require('cors');
// Using built-in fetch (Node.js 18+)

const app = express();
const PORT = process.env.PORT || 3002;

// CORS configuration for production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://navitruck.app',
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, мобильные приложения)
    if (!origin) return callback(null, true);
    
    // Разрешаем если origin в списке или это development
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: [],
  credentials: true,
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 204
};

// Early CORS headers for all requests (explicit) + fast OPTIONS 204
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
  }
  next();
});

app.use(cors(corsOptions));
app.use(express.json());

// Explicitly handle preflight requests
app.options('*', cors(corsOptions));

// Логирование запросов
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - Origin: ${req.get('origin') || 'none'}`);
  next();
});

// Trak-4 API proxy endpoint
app.post('/api/trak4/device', async (req, res) => {
  try {
    console.log('📡 Proxy: Received request for Trak-4 device data');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    
    const { APIKey, DeviceID } = req.body;
    
    if (!APIKey || !DeviceID) {
      console.log('❌ Missing required parameters');
      return res.status(400).json({
        error: 'Missing required parameters',
        details: 'Both APIKey and DeviceID are required'
      });
    }

    const apiUrl = 'https://api-v3.trak-4.com/Device/GetDeviceByID';
    
    console.log(`🌐 Forwarding to Trak-4 API: ${apiUrl}`);
    console.log(`📦 Device ID: ${DeviceID}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NTruck-Proxy/1.0'
      },
      body: JSON.stringify({
        APIKey,
        DeviceID
      }),
      timeout: 10000 // 10 seconds timeout
    });

    const data = await response.json();
    
    console.log(`📥 Received response from Trak-4 (Status: ${response.status})`);
    
    if (!response.ok) {
      console.log('⚠️ Trak-4 API returned error:', data);
      return res.status(response.status).json({
        error: 'Trak-4 API Error',
        status: response.status,
        statusText: response.statusText,
        details: JSON.stringify(data)
      });
    }

    console.log('✅ Successfully proxied GPS data');
    res.json(data);
  } catch (error) {
    console.error('❌ Proxy Error:', error);
    res.status(500).json({
      error: 'Proxy Server Error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const healthcheck = {
    status: 'OK',
    message: 'Trak-4 GPS Proxy Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'production',
    version: '1.0.0'
  };
  
  res.json(healthcheck);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'NTruck GPS Proxy Server',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      proxy: 'POST /api/trak4/device'
    },
    documentation: 'See DEPLOYMENT_GUIDE.md'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    availableEndpoints: {
      health: 'GET /health',
      proxy: 'POST /api/trak4/device'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🚀 ================================');
  console.log('   Trak-4 GPS Proxy Server');
  console.log('   ================================');
  console.log('');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log('');
  console.log('📋 Endpoints:');
  console.log(`   🔗 Proxy:  POST /api/trak4/device`);
  console.log(`   ❤️  Health: GET  /health`);
  console.log('');
  console.log('✅ Server is ready to accept connections');
  console.log('');
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\n🛑 Received shutdown signal');
  console.log('📦 Closing server gracefully...');
  
  server.close(() => {
    console.log('✅ Server closed');
    console.log('👋 Goodbye!');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⏰ Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;

