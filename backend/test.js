const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

// Configuration
const config = {
  webhookServerUrl: 'http://localhost:3000/api', // Your main webhook server
  mockServerPort: 3001,                         // Port for the mock server to receive webhooks
  testSources: ['github', 'stripe', 'sensor_updates'], // Sources to test
  auth: {
    email: 'shannu@gmail.com',
    password: 'shannu123'
  }
};

// Axios instance with cookie handling
const axiosInstance = axios.create({
  withCredentials: true
});

// Create a mock server to receive webhook callbacks
const startMockServer = () => {
  const app = express();
  app.use(bodyParser.json());
  
  // Simple endpoint to receive webhook callbacks
  app.post('/webhook-callback', (req, res) => {
    console.log('\n📬 WEBHOOK RECEIVED:');
    console.log('Source:', req.body.source);
    console.log('Event ID:', req.body.eventId);
    console.log('Timestamp:', new Date(req.body.timestamp).toLocaleString());
    console.log('Data:', JSON.stringify(req.body.payload, null, 2));
    console.log('-'.repeat(50));
    
    // Simulate occasional failure for testing retry logic
    if (Math.random() < 0.2) {
      console.log('🔴 Simulating callback failure (20% chance)');
      return res.status(500).json({ success: false, message: 'Simulated failure' });
    }
    
    res.status(200).json({ success: true, message: 'Webhook received' });
  });
  
  return new Promise((resolve) => {
    const server = app.listen(config.mockServerPort, () => {
      console.log(`🚀 Mock webhook receiver running on http://localhost:${config.mockServerPort}`);
      resolve(server);
    });
  });
};

// Login to get JWT token and cookie
const login = async () => {
  try {
    console.log('🔑 Logging in...');
    
    const response = await axiosInstance.post(`${config.webhookServerUrl}/auth/login`, {
      email: config.auth.email,
      password: config.auth.password
    });
    
    console.log('✅ Login successful');
    
    // Extract token from cookies or response
    let token = '';
    
    // If the token is returned directly in the response
    if (response.data && response.data.token) {
      token = response.data.token;
      console.log('Token received in response body');
    } 
    // If token is in a cookie
    else if (response.headers['set-cookie']) {
      const cookies = response.headers['set-cookie'];
      console.log('Cookies received:', cookies);
      
      // Extract token from cookie
      for (const cookie of cookies) {
        if (cookie.includes('token=')) {
          const tokenMatch = cookie.match(/token=([^;]+)/);
          if (tokenMatch && tokenMatch[1]) {
            token = tokenMatch[1];
            console.log('Token extracted from cookie');
            break;
          }
        }
      }
    }
    
    if (!token) {
      console.warn('⚠️ Could not extract token from response');
    }
    
    return token;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
};

// Register a webhook subscription
const registerSubscription = async (source, token) => {
  try {
    const callbackUrl = `http://localhost:${config.mockServerPort}/webhook-callback`;
    
    console.log(`📝 Registering subscription for "${source}" to ${callbackUrl}`);
    
    const response = await axiosInstance.post(
      `${config.webhookServerUrl}/webhooks/subscribe`,
      {
        source,
        callbackUrl
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log(`✅ Subscription registered:`, response.data.subscription);
    return response.data.subscription;
  } catch (error) {
    console.error(`❌ Failed to register subscription for "${source}":`, 
      error.response?.data || error.message);
    return null;
  }
};

// Trigger a webhook event
const triggerWebhook = async (source) => {
  try {
    // Generate sample data based on source
    let payload;
    
    switch (source) {
      case 'github':
        payload = {
          event: 'push',
          repository: 'user/repo',
          commits: [{ 
            id: Math.random().toString(36).substring(2, 10), 
            message: 'Update README.md' 
          }]
        };
        break;
      case 'stripe':
        payload = {
          event: 'payment.succeeded',
          customer: `cus_${Math.random().toString(36).substring(2, 10)}`,
          amount: (Math.random() * 100).toFixed(2),
          currency: 'usd'
        };
        break;
      case 'sensor_updates':
        payload = {
          sensorId: `sensor-${Math.floor(Math.random() * 100)}`,
          temperature: (Math.random() * 30 + 10).toFixed(1),
          humidity: (Math.random() * 100).toFixed(1),
          timestamp: new Date().toISOString()
        };
        break;
      default:
        payload = {
          message: `Test event from ${source}`,
          timestamp: new Date().toISOString()
        };
    }
    
    console.log(`📤 Triggering webhook for "${source}" with payload:`, payload);
    
    const response = await axiosInstance.post(
      `${config.webhookServerUrl}/webhooks/incoming/${source}`, 
      payload
    );
    
    console.log(`✅ Webhook triggered:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to trigger webhook for "${source}":`, 
      error.response?.data || error.message);
    return null;
  }
};

// List subscriptions
const listSubscriptions = async (token) => {
  try {
    console.log('📋 Fetching subscriptions...');
    
    const response = await axiosInstance.get(
      `${config.webhookServerUrl}/webhooks/subscriptions`, 
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('✅ Subscriptions:', response.data.subscriptions);
    return response.data.subscriptions;
  } catch (error) {
    console.error('❌ Failed to list subscriptions:', error.response?.data || error.message);
    return [];
  }
};

// Main test function
const runTest = async () => {
  console.log('🧪 Starting webhook test...');
  
  // Start the mock server to receive callbacks
  const mockServer = await startMockServer();
  
  try {
    // Login to get token
    const token = await login();
    
    if (!token) {
      throw new Error('Failed to obtain authentication token');
    }
    
    // Register subscriptions for all test sources
    const subscriptions = [];
    for (const source of config.testSources) {
      const subscription = await registerSubscription(source, token);
      if (subscription) {
        subscriptions.push(subscription);
      }
    }
    
    // List all subscriptions
    console.log("Listing all Subscriptions: ")
    await listSubscriptions(token);
    
    // Trigger webhooks for testing
    console.log('\n🔄 Testing webhook delivery...');
    for (const source of config.testSources) {
      await triggerWebhook(source);
      // Add a small delay between triggers
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🔍 Now waiting to receive webhooks on the mock server...');
    console.log('Press Ctrl+C to stop the test');
    
    // Keep the script running to receive webhooks
    setInterval(() => {
      const randomSource = config.testSources[Math.floor(Math.random() * config.testSources.length)];
      triggerWebhook(randomSource).catch(console.error);
    }, 10000); // Trigger a random webhook every 10 seconds
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    mockServer.close();
  }
};

// Run the test
runTest().catch(console.error);