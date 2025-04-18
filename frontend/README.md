Redis Queue Webhook Flow Summary
The Redis queue implementation for your webhook system creates a robust, scalable flow for processing webhooks. Here's a summary of the process flow:
1. Webhook Receipt

An external system sends a webhook to your API endpoint
The controller immediately responds with a 202 status (Accepted)
For each active subscription matching the source, a WebhookEvent is created in MongoDB with "pending" status

2. Queueing with Redis

Each webhook event ID is pushed to a Redis list using RPUSH webhook:queue eventId
A notification is published via Redis Pub/Sub on the webhook:new channel
This separates webhook receipt from processing, allowing for scalability

3. Worker Processing

A webhook worker subscribes to the webhook:new channel
When notification arrives, or on a timer (every 5 seconds), it checks the queue
It pulls the next event from the queue using LPOP webhook:queue
The worker fetches the full event details from MongoDB
It attempts to deliver the webhook to the subscriber's callback URL

4. Success Path

If delivery succeeds, the event status is updated to "success" in MongoDB
Processing is complete for this webhook event

5. Failure and Retry Path

If delivery fails, the event status is updated to "failed" in MongoDB
The event ID is added to a Redis sorted set (ZADD webhook:retry score eventId)
The score is a Unix timestamp representing when to retry (using exponential backoff)

6. Retry Processing

A retry processor periodically checks the sorted set using ZRANGEBYSCORE webhook:retry 0 currentTime
For each due event, it removes it from the set and attempts delivery again
If retry succeeds, the event is updated to "success"
If retry fails but under max retries, it's re-added to the retry set with increased delay
If max retries reached, it's marked as permanently failed

7. Monitoring and Recovery

The debug endpoint allows checking queue lengths and Redis connection
Regular interval checks ensure no events get stuck in the queue

This architecture provides several benefits:

Immediate response to webhook sources
Asynchronous processing for better performance
Reliable delivery with persistent storage in MongoDB
Automatic retries with exponential backoff
Scalability as workers can be distributed across multiple servers
Resilience to application restarts or crashes

The Redis queue acts as the coordination mechanism between webhook receipt and processing, creating a system that's both fast and reliable.





Webhook Processing Architecture
Summary of Webhook Flow:
Webhook Processing Architecture (Flow Overview):
1. Webhook Receipt
- External system sends a webhook to your API.
- Your controller responds immediately with HTTP 202.
- Event is saved in MongoDB with 'pending' status.
2. Queueing with Redis
- Event ID is pushed to 'webhook:queue' using RPUSH.
- Redis publishes a message to 'webhook:new' channel.
3. Worker Processing
- Worker subscribes to 'webhook:new' channel.
- On message, LPOP event from 'webhook:queue'.
- Fetch event from MongoDB and attempt delivery.
4. Success Path
- On success, update MongoDB status to 'success'.
5. Failure and Retry Path
- On failure, update status to 'failed'.
- Add to 'webhook:retry' (Redis ZSET) with retry score.
6. Retry Processing
- A retry worker polls 'webhook:retry' using ZRANGEBYSCORE.
- On due timestamp, re-attempt delivery.
- If fail but retries left, re-add with increased delay.
- If max retries hit, mark as permanently failed.
7. Monitoring & Recovery
- Expose debug endpoints and use setInterval to retry missed events.
Key Redis Keys Used:
- webhook:queue -> Redis List (main queue)
- webhook:new -> Pub/Sub channel (notify workers)
- webhook:retry -> Redis ZSET (sorted retry queue)