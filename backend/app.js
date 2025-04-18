const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const redisService = require('./services/redisService');
const webhookWorker = require('./workers/webhookWorker');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const webhookRoutes = require('./routes/webhooks');

// Initialize Express app
const app = express();

// Middlewares
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Add cookie parser middleware

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    try {
      // Initialize Redis connection
      await redisService.initializeRedis();
      console.log('Connected to Redis');
      
      // Start webhook worker to process webhook queue
      await webhookWorker.startWorker();
      
      // Start retry processor
      webhookWorker.startRetryProcessor(1); // Check every 1 minute
      
      console.log('Application fully initialized');
    } catch (error) {
      console.error('Error during initialization:', error);
    }
  })
  .catch(err => console.error('Could not connect to MongoDB', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('API is running');
});

// Add a debug route to check Redis connection
app.get('/debug/redis', async (req, res) => {
  try {
    const client = redisService.getClient();
    await client.set('test', 'working');
    const value = await client.get('test');
    
    res.json({
      status: 'ok',
      redis: value === 'working' ? 'connected' : 'error',
      queueLength: await client.llen('webhook:queue'),
      retryQueueLength: await client.zcard('webhook:retry')
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

// // Main application file
// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const cookieParser = require('cookie-parser');
// const retryService = require('./services/retryService');

// // Load environment variables
// dotenv.config();

// // Import routes
// const authRoutes = require('./routes/auth');
// const webhookRoutes = require('./routes/webhooks');

// // Initialize Express app
// const app = express();

// // Middlewares
// app.use(cors({
//   origin: 'http://localhost:5173',
//   credentials: true
// }));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser()); // Add cookie parser middleware

// // Connect to MongoDB
// mongoose
//   .connect(process.env.MONGODB_URI)
//   .then(async () => {
//     console.log('Connected to MongoDB');
//     // await initializeRedis();
//     // Start the webhook retry processor after DB connection is established
//     retryService.startRetryProcessor(5); // Check every 5 minutes
//   })
//   .catch(err => console.error('Could not connect to MongoDB', err));

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/webhooks', webhookRoutes);

// // Basic route
// app.get('/', (req, res) => {
//   res.send('API is running');
// });

// // Error handling middleware
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).send('Something broke!');
// });

// // Start server
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// module.exports = app;