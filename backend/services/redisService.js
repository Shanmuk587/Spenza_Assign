// services/redisService.js
const { createClient } = require('redis');
let redisClient;

// Initialize Redis connection

const initializeRedis = async () => {
  try {
    redisClient = createClient({
        username: 'default',
        password: 'CDoOooEBFzY8NdVHcFafVZ9zLwX6o3od',
        socket: {
            host: 'redis-18492.c301.ap-south-1-1.ec2.redns.redis-cloud.com',
            port: 18492,
            reconnectStrategy: retries => Math.min(retries * 50, 5000)
        }
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
    
    redisClient.on('connect', () => {
      console.log('Redis client connected');
    });
    
    await redisClient.connect()
    await redisClient.ping();
    console.log('Redis ping successful');
    return redisClient;
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    throw error;
  }
};

const getClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};


//  Add webhook event to processing queue 
const addWebhookToQueue = async (eventId) => {
  try {
    // First add to the queue
    await redisClient.rPush('webhook:queue', eventId);
    // Then publish notification about the new webhook
    await redisClient.publish('webhook:new', eventId);
    console.log(`Successfully added ${eventId} to webhook:queue and published webhook:new event`);
    return true;
  } catch (error) {
    console.error('Error adding webhook to queue:', error);
    return false;
  }
};


// This function retrieves the next webhook event from the queue
const getNextWebhook = async () => {
  try {
    // Use LPOP to get and remove the first item from the queue
    const eventId = await redisClient.lPop('webhook:queue');
    if (eventId) {
      console.log(`Retrieved event ${eventId} from webhook:queue`);
    }
    return eventId;
  } catch (error) {
    console.error('Error getting webhook from queue:', error);
    return null;
  }
};


//Add webhook to retry queue with exponential backoff
 
const addWebhookToRetryQueue = async (eventId, retryCount) => {
  try {
    // Calculate delay - similar to your existing retryService logic
    const baseDelay = 5 * 60; // 5 minutes in seconds
    const maxDelay = 24 * 60 * 60; // 24 hours max
    
    const delay = Math.min(
      baseDelay * Math.pow(3, retryCount),
      maxDelay
    );
    
    const score = Math.floor(Date.now() / 1000) + delay;
    
    // Add to sorted set with score as retry time
    await redisClient.zAdd('webhook:retry', [
      {
        score: score,
        value: eventId.toString()
      }
    ]);
    console.log(`Added ${eventId} to retry queue with score ${score} (retry in ${delay} seconds)`);
    return true;
  } catch (error) {
    console.error('Error adding webhook to retry queue:', error);
    return false;
  }
};


//Get webhooks due for retry

const getWebhooksDueForRetry = async () => {
  try {
    const now = Math.floor(Date.now() / 1000);
    // Get all webhook IDs with score (retry time) less than current time
    const eventIds = await redisClient.zRangeByScore('webhook:retry', 0, now);
    if (eventIds.length > 0) {
      console.log(`Found ${eventIds.length} webhooks due for retry`);
    }
    return eventIds;
  } catch (error) {
    console.error('Error getting webhooks due for retry:', error);
    return [];
  }
};


//Remove webhook from retry queue

const removeWebhookFromRetryQueue = async (eventId) => {
  try {
    await redisClient.zRem('webhook:retry', eventId);
    console.log(`Removed ${eventId} from retry queue`);
    return true;
  } catch (error) {
    console.error('Error removing webhook from retry queue:', error);
    return false;
  }
};

module.exports = {
  initializeRedis,
  getClient,
  addWebhookToQueue,
  getNextWebhook,
  addWebhookToRetryQueue,
  getWebhooksDueForRetry,
  removeWebhookFromRetryQueue
};