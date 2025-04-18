// workers/webhookWorker.js
const redisService = require('../services/redisService');
const WebhookEvent = require('../models/WebhookEvent');
const WebhookSubscription = require('../models/WebhookSubscription');
const axios = require('axios');

let isProcessing = false;
let workerRunning = false;

// Process a single webhook from the queue
const processNextWebhook = async () => {
  // Skip if already processing
  if (isProcessing) return;
  
  isProcessing = true;
  try {
    // Get next webhook from queue
    const eventId = await redisService.getNextWebhook();
    
    if (!eventId) {
      isProcessing = false;
      return; // No events to process
    }
    
    console.log(`Processing webhook event: ${eventId}`);
    
    // Get event from database
    const event = await WebhookEvent.findById(eventId);
    
    if (!event) {
      console.log(`Event not found in database: ${eventId}`);
      isProcessing = false;
      return;
    }
    
    // Get subscription info
    const subscription = await WebhookSubscription.findById(event.subscriptionId);
    
    if (!subscription || !subscription.active) {
      console.log(`Subscription not found or inactive for event: ${eventId}`);
      event.status = 'failed';
      event.errorMessage = 'Subscription no longer active';
      await event.save();
      isProcessing = false;
      return;
    }
    
    // Update event status
    event.status = 'pending';
    await event.save();
    
    // Attempt to deliver webhook
    try {
      const response = await axios.post(subscription.callbackUrl, {
        source: event.source,
        payload: event.payload,
        timestamp: new Date(),
        eventId: event._id
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Webhook-Server'
        },
        timeout: 5000 // 5 second timeout
      });

      // Update event with success status
      event.status = 'success';
      event.statusCode = response.status;
      event.processedAt = new Date();
      await event.save();
      
      console.log(`Webhook delivered to ${subscription.callbackUrl}, status: ${response.status}`);
    } catch (error) {
      // Handle delivery failure
      event.status = 'failed';
      event.statusCode = error.response?.status || 0;
      event.errorMessage = error.message;
      event.nextRetryAt = calculateNextRetryTime(0); // First retry
      event.retryCount = 0;
      await event.save();
      
      // Add to retry queue
      await redisService.addWebhookToRetryQueue(eventId, 0);
      
      console.error(`Failed to deliver webhook to ${subscription.callbackUrl}:`, error.message);
    }
  } catch (error) {
    console.error('Error in webhook worker:', error);
  } finally {
    isProcessing = false;
    
    // Try to process next item immediately if there are more in queue
    // setTimeout(processNextWebhook, 100);
  }
};

// Start worker to listen for new webhooks
const startWorker = async () => {
  if (workerRunning) return;
  
  workerRunning = true;
  
  try {
    // Get Redis client
    const redisClient = redisService.getClient();
    
    // Subscribe to new webhook events
    const subscriber = redisClient.duplicate();
    await subscriber.connect()
    await subscriber.subscribe('webhook:new', async (message) => {
        console.log('New webhook received, processing...');
        await processNextWebhook();
      });

    
    console.log('Webhook worker started and listening for events');
    
    // Run initial processor for any pending webhooks in queue
    processNextWebhook();
    
    // Check periodically for any webhooks that might have been missed
    setInterval(processNextWebhook, 5000); // Every 5 seconds
  } catch (error) {
    console.error('Failed to start webhook worker:', error);
    workerRunning = false;
  }
};

// Process events that need to be retried
const processRetries = async () => {
  try {
    // Get events due for retry from Redis
    const eventIds = await redisService.getWebhooksDueForRetry();
    
    if (eventIds.length === 0) {
      return;
    }
    
    console.log(`Processing ${eventIds.length} webhook event retries`);
    
    // Process each event
    for (const eventId of eventIds) {
      try {
        // Remove from retry queue immediately to prevent duplicate processing
        await redisService.removeWebhookFromRetryQueue(eventId);
        
        // Get event from database
        const event = await WebhookEvent.findById(eventId);
        
        if (!event) {
          console.log(`Retry event not found in database: ${eventId}`);
          continue;
        }
        
        // Get subscription info
        const subscription = await WebhookSubscription.findById(event.subscriptionId);
        
        if (!subscription || !subscription.active) {
          console.log(`Subscription not found or inactive for retry event: ${eventId}`);
          event.status = 'failed';
          event.errorMessage = 'Subscription no longer active';
          await event.save();
          continue;
        }
        
        // Update status to retrying
        event.status = 'retrying';
        await event.save();
        
        // Attempt to deliver the webhook
        const response = await axios.post(subscription.callbackUrl, {
          source: event.source,
          payload: event.payload,
          timestamp: new Date(),
          eventId: event._id,
          retry: true,
          retryCount: event.retryCount + 1
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
        
        console.log(`Retry #${event.retryCount} successful for event ${event._id}`);
      } catch (error) {
        // Get event from database
        const event = await WebhookEvent.findById(eventId);
        
        if (!event) {
          console.log(`Failed retry event not found in database: ${eventId}`);
          continue;
        }
        
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
        } else {
          // Schedule next retry
          event.nextRetryAt = calculateNextRetryTime(event.retryCount);
          event.status = 'retrying';
          
          // Add back to retry queue with increased delay
          await redisService.addWebhookToRetryQueue(eventId, event.retryCount);
        }
        
        await event.save();
        console.error(`Retry #${event.retryCount} failed for event ${event._id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error processing webhook retries:', error);
  }
};

// Start the retry processor
const startRetryProcessor = (intervalMinutes = 1) => {
  console.log(`Starting webhook retry processor, checking every ${intervalMinutes} minutes`);
  
  // Process immediately on startup
  processRetries();
  
  // Then set interval
  const interval = intervalMinutes * 60 * 1000;
  setInterval(processRetries, interval);
};

// Helper function to calculate next retry time
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

module.exports = {
  startWorker,
  startRetryProcessor,
  processNextWebhook,
  processRetries
};