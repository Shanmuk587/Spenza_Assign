// services/retryService.js
const WebhookEvent = require('../models/WebhookEvent');
const WebhookSubscription = require('../models/WebhookSubscription');
const redisService = require('./redisService');
const axios = require('axios');

// Calculate next retry time with exponential backoff
const calculateNextRetryTime = (retryCount) => {
  // 5min, 15min, 45min, 2h, 6h, etc.
  const baseDelay = 5 * 60 * 1000; // 5 minutes in milliseconds
  const maxDelay = 24 * 60 * 60 * 1000; // 24 hours max
  
  const delay = Math.min(
    baseDelay * Math.pow(3, retryCount),
    maxDelay
  );
  
  return new Date(Date.now() + delay);
};

// Process a single event retry
const processEventRetry = async (event) => {
  try {
    // Find subscription to get callback URL
    const subscription = await WebhookSubscription.findById(event.subscriptionId);
    console.log('Retrying webhook delivery for event:', event._id);
    
    if (!subscription || !subscription.active) {
      // Subscription no longer exists or is inactive
      event.status = 'failed';
      event.errorMessage = 'Subscription no longer active';
      await event.save();
      return;
    }
    
    // Update status to retrying
    event.status = 'retrying';
    await event.save();
    
    // Store the event data in Redis for quick access during processing
    await redisService.storeWebhookEvent(event._id.toString(), {
      subscriptionId: event.subscriptionId.toString(),
      source: event.source,
      payload: event.payload
    });
    
    // Attempt to deliver the webhook
    const response = await axios.post(subscription.callbackUrl, {
      source: event.source,
      payload: event.payload,
      timestamp: new Date(),
      eventId: event._id,
      retry: true,
      retryCount: event.retryCount
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Webhook-Server'
      },
      timeout: 10000 // 10 second timeout for retries
    });
    
    // Update event on success
    event.status = 'success';
    event.statusCode = response.status;
    event.processedAt = new Date();
    event.retryCount += 1;
    await event.save();
    
    // Remove from Redis retry queue
    await redisService.removeWebhookFromRetryQueue(event._id.toString());
    
    console.log(`Retry #${event.retryCount} successful for event ${event._id}`);
  } catch (error) {
    // Handle retry failure
    event.status = 'failed';
    event.statusCode = error.response?.status || 0;
    event.errorMessage = error.message;
    event.retryCount += 1;
    
    // Check if we should stop retrying
    const MAX_RETRIES = 6;
    if (event.retryCount >= MAX_RETRIES) {
      event.errorMessage += ' | Max retries exceeded';
      console.log(`Max retries (${MAX_RETRIES}) exceeded for event ${event._id}`);
      await redisService.removeWebhookFromRetryQueue(event._id.toString());
    } else {
      // Schedule next retry
      event.nextRetryAt = calculateNextRetryTime(event.retryCount);
      event.status = 'retrying';
      
      // Add to Redis retry queue with appropriate delay
      await redisService.addWebhookToRetryQueue(event._id.toString(), event.retryCount);
    }
    
    await event.save();
    console.error(`Retry #${event.retryCount} failed for event ${event._id}:`, error.message);
  }
};

// Process all events that need retrying
const processRetries = async () => {
  try {
    // Get events from Redis that are due for retry
    const eventIds = await redisService.getWebhooksDueForRetry();
    
    if (eventIds.length === 0) {
      return;
    }
    
    console.log(`Processing ${eventIds.length} webhook event retries from Redis queue`);
    
    // Process each event
    for (const eventId of eventIds) {
      // Get event from database
      const event = await WebhookEvent.findById(eventId);
      if (event) {
        await processEventRetry(event);
      } else {
        // Event no longer exists in DB, remove from Redis queue
        await redisService.removeWebhookFromRetryQueue(eventId);
      }
    }
  } catch (error) {
    console.error('Error processing webhook retries:', error);
  }
};

// Start the retry processor
const startRetryProcessor = (intervalMinutes = 5) => {
  console.log(`Starting webhook retry processor, checking every ${intervalMinutes} minutes`);
  
  // Process immediately on startup
  processRetries();
  
  // Then set interval
  const interval = intervalMinutes * 60 * 1000;
  setInterval(processRetries, interval);
};

module.exports = {
  processRetries,
  startRetryProcessor
};

// const WebhookEvent = require('../models/WebhookEvent');
// const WebhookSubscription = require('../models/WebhookSubscription');
// const axios = require('axios');

// // Calculate next retry time with exponential backoff
// const calculateNextRetryTime = (retryCount) => {
//   // 5min, 15min, 45min, 2h, 6h, etc.
//   const baseDelay = 5 * 60 * 1000; // 5 minutes in milliseconds
//   const maxDelay = 24 * 60 * 60 * 1000; // 24 hours max
  
//   const delay = Math.min(
//     baseDelay * Math.pow(3, retryCount),
//     maxDelay
//   );
  
//   return new Date(Date.now() + delay);
// };

// // Process a single event retry
// const processEventRetry = async (event) => {
//   try {
  
//     // Find subscription to get callback URL
//     const subscription = await WebhookSubscription.findById(event.subscriptionId);
//     console.log('retrying processeventretry')
    
//     if (!subscription || !subscription.active) {
//       // Subscription no longer exists or is inactive
//       event.status = 'failed';
//       event.errorMessage = 'Subscription no longer active';
//       await event.save();
//       return;
//     }
    
//     // Update status to retrying
//     event.status = 'retrying';
//     await event.save();
    
//     // Attempt to deliver the webhook
//     const response = await axios.post(subscription.callbackUrl, {
//       source: event.source,
//       payload: event.payload,
//       timestamp: new Date(),
//       eventId: event._id,
//       retry: true,
//       retryCount: event.retryCount
//     }, {
//       headers: {
//         'Content-Type': 'application/json',
//         'User-Agent': 'Webhook-Server'
//       },
//       timeout: 10000 // 10 second timeout for retries
//     });
    
//     // Update event on success
//     event.status = 'success';
//     event.statusCode = response.status;
//     event.processedAt = new Date();
//     event.retryCount += 1;
//     await event.save();
    
//     console.log(`Retry #${event.retryCount} successful for event ${event._id}`);
//   } catch (error) {
//     // Handle retry failure
//     event.status = 'failed';
//     event.statusCode = error.response?.status || 0;
//     event.errorMessage = error.message;
//     event.retryCount += 1;
    
//     // Check if we should stop retrying
//     const MAX_RETRIES = 6;
//     if (event.retryCount >= MAX_RETRIES) {
//       event.errorMessage += ' | Max retries exceeded';
//       console.log(`Max retries (${MAX_RETRIES}) exceeded for event ${event._id}`);
//     } else {
//       // Schedule next retry
//       event.nextRetryAt = calculateNextRetryTime(event.retryCount);
//       event.status = 'retrying';
//     }
    
//     await event.save();
//     console.error(`Retry #${event.retryCount} failed for event ${event._id}:`, error.message);
//   }
// };

// // Process all events that need retrying
// const processRetries = async () => {
//   try {
//     // Find events that need retry and are due
//     const events = await WebhookEvent.find({
//       status: 'failed',
//       nextRetryAt: { $lte: new Date() }
//     }).limit(50); // Process in batches
//     if (events.length === 0) {
//       return;
//     }
//     console.log(`Processing ${events.length} webhook event retries`);
    
//     // Process each event
//     for (const event of events) {
//       await processEventRetry(event);
//     }
//   } catch (error) {
//     console.error('Error processing webhook retries:', error);
//   }
// };

// // Start the retry processor
// const startRetryProcessor = (intervalMinutes = 5) => {
//   console.log(`Starting webhook retry processor, checking every ${intervalMinutes} minutes`);
  
//   // Process immediately on startup
//   processRetries();
  
//   // Then set interval
//   const interval = intervalMinutes * 60 * 1000;
//   setInterval(processRetries, interval);
// };

// module.exports = {
//   processRetries,
//   startRetryProcessor
// };