# Webhook Delivery System – Backend

This repository contains the backend implementation of a **reliable, scalable webhook handling system** using **Node.js**, **Express**, **MongoDB**, and **Redis**. The system ensures asynchronous delivery, automatic retries, and robustness through queue-based architecture.

---

## Features

- Immediate HTTP 202 response to incoming webhooks
- Queue-based processing using Redis (List & Pub/Sub)
- Exponential retry logic via Redis Sorted Set (ZSET)
- Persistent storage of webhook events in MongoDB
- Monitoring & recovery support
- Scalable architecture supporting distributed workers

---

## Architecture Overview

```
        ┌────────────┐
        │ External   │
        │ System     │
        └────┬───────┘
             │
     [Webhook POST Request]
             │
             ▼
     ┌───────────────┐
     │ API Controller│
     └────┬──────────┘
          │ Immediate 202
          │
          ▼
 ┌─────────────────────┐
 │ Save to MongoDB     │ <────────┐
 │ (status: pending)   │          │
 └────────┬────────────┘          │
          │                       │
          ▼                       │
  [Push ID to Redis queue]        │
  [Publish via webhook:new]       │
          │                       │
          ▼                       │
 ┌────────────┐       ┌──────────────┐
 │  Worker    │<──────│  Subscriber  │
 └────┬───────┘       └────┬─────────┘
      │                    │
 [LPOP queue]              │
 [Fetch event from DB]     │
 [POST to callback URL]    │
      │                    │
      ▼                    │
┌────────────┐             │
│ Success?   │────Yes────▶│
└────┬───────┘             │
     │No                   │
     ▼                    │
[Update to 'failed']      │
[ZADD to retry queue]     │
     │                    │
     ▼                    │
 ┌────────────┐
 │ Retry Loop │
 └────┬───────┘
      ▼
[ZRANGEBYSCORE]
[Retry if due]
[Exponential Backoff]
[Max retries?]

```

---

## Design Choices & Architecture

### 1. **Separation of Concerns**
- Webhook receipt is decoupled from processing using Redis. This ensures quick API responses and prevents long-running operations from blocking incoming traffic.

### 2. **Redis for Fast Queuing**
- **Redis List (`webhook:queue`)** acts as the primary queue.
- **Pub/Sub (`webhook:new`)** notifies workers in real-time.
- **Redis ZSET (`webhook:retry`)** manages scheduled retries.

### 3. **Retry Mechanism**
- Failed deliveries are retried with **exponential backoff**.
- Retry timestamps are stored as scores in the ZSET.

### 4. **Persistence with MongoDB**
- Every webhook event is stored in MongoDB to track status (`pending`, `success`, `failed`, `permanent_failure`).

### 5. **Scalability & Fault Tolerance**
- Multiple workers can run concurrently across servers.
- Redis ensures atomic queue operations.
- MongoDB persists the state even across system restarts.

---
## 🕸️ Webhook Processing Architecture

This system implements a **reliable, asynchronous webhook delivery mechanism** using **MongoDB**, **Redis**, and **Node.js workers**.

---

### Summary of Webhook Flow

#### 1. Webhook Receipt
- External systems send a webhook to your API endpoint.
- The controller **immediately responds with `HTTP 202 Accepted`**.
- Event is saved to **MongoDB** with a status of `'pending'`.

#### 2. Queueing with Redis
- Event ID is pushed into a Redis **List**: `webhook:queue` using `RPUSH`.
- A notification is sent via Redis **Pub/Sub** channel: `webhook:new`.

#### 3. Worker Processing
- Worker is subscribed to the `webhook:new` channel.
- On receiving a message:
  - Worker `LPOP`s the event from `webhook:queue`.
  - Fetches the full event data from **MongoDB**.
  - Attempts to deliver the webhook to its destination.

#### 4. Success Path
- If delivery is successful:
  - MongoDB event status is updated to `'success'`.

#### 5. Failure and Retry Path
- If delivery fails:
  - Status is updated to `'failed'`.
  - The event is added to `webhook:retry` (**Redis ZSET**) with a score representing the **next retry timestamp**.

#### 6. Retry Logic
- A retry worker periodically checks `webhook:retry` using `ZRANGEBYSCORE`.
- For events whose retry timestamp is due:
  - Re-attempt delivery.
  - If it fails **but retry attempts remain**, it’s re-added with an increased delay.
  - If **max retries** are reached, it is marked as `'permanently_failed'`.

#### 7. Monitoring & Recovery
- Optional **debug endpoints** to inspect the state of queues and failed events.
- Periodic retries using `setInterval` for resilience and missed events.

---

### Key Redis Keys Used

| Redis Key         | Type       | Description                              |
|------------------|------------|------------------------------------------|
| `webhook:queue`  | List       | Main event queue for incoming webhooks   |
| `webhook:new`    | Pub/Sub    | Channel to notify workers of new events  |
| `webhook:retry`  | Sorted Set | Stores failed events for scheduled retry |

---

## Getting Started

### Prerequisites

Ensure the following are installed:

- Node.js (v18+)
- MongoDB
- Redis

---

### 1. Clone the repository

```bash
git clone https://github.com/your-username/webhook-backend.git
cd webhook-backend
```

---

### 2. Install dependencies

```bash
npm install
```

---

### 3. Environment Setup

Create a `.env` file with the following content:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/webhooks
JWT_SECRET=jwtsecret
NODE_ENV='development'
REDIS_PASSWORD=redispassword
```

---

### 4. Start the services

#### Start the main server (API and worker):

```bash
npm run dev
```

---

## API Endpoints

### `POST /webhook/:source`

Receives a webhook from external systems.

---

### **Authentication Endpoints**

| Method | Endpoint       | Description                 | Access       |
|--------|----------------|-----------------------------|--------------|
| POST   | `/register`    | Register a new user         | Public       |
| POST   | `/login`       | Log in a user               | Public       |
| POST   | `/logout`      | Log out the current user    | Public       |
| GET    | `/me`          | Get current authenticated user info | Protected ✅ |

---

### **Webhook Subscription Endpoints**

| Method | Endpoint                     | Description                                  | Access       |
|--------|------------------------------|----------------------------------------------|--------------|
| POST   | `/subscribe`                 | Subscribe to a webhook                       | Protected ✅ |
| GET    | `/subscriptions`            | Get list of user subscriptions               | Protected ✅ |
| DELETE | `/unsubscribe/:id`           | Unsubscribe from a specific webhook          | Protected ✅ |
| DELETE | `/subscription/:id`          | Delete a specific subscription               | Protected ✅ |
| GET    | `/subscription/:id/events` | Get events for a specific subscription      | Protected ✅ |
| GET    | `/events`                    | Get all events received via user webhooks    | Protected ✅ |

---

### **Incoming Webhook Endpoint**

| Method | Endpoint              | Description                                     | Access |
|--------|-----------------------|-------------------------------------------------|--------|
| POST   | `/incoming/:source`   | Receive a webhook from an external source      | Public |

---

## Testing & Debugging

- Webhook events are logged in MongoDB.
- Enable verbose logs in `webhookWorker.js` to see delivery attempts and retries.

---

## Security Notes

- Validate source IPs or use secrets for authenticating incoming webhooks.
- Limit retries to avoid infinite loops or webhook flooding.
- Use HTTPS endpoints for secure delivery.

---

## Improvements

- Add dead-letter queue (DLQ) for manual inspection of permanently failed events.  
- Adding Validation to Incoming webhook endpoint
- Enable webhook signature verification.
- Add dashboard with metrics (using Grafana or Prometheus).
- Integrate rate limiting  
- Debugging with current Redis queue size and retry queue info to test in actual Real life.

---

---

## `test.js` Simulation Tool

### What It Does
The `test.js` script is a **self-contained simulation utility** that mimics the **entire webhook system workflow**, making it perfect for:

- Local testing  
- CI/CD pipeline validations  
- Demos and presentations  

---

### Simulation Workflow
Here's what the script simulates step-by-step:

1. **Creates mock webhook events**
2. **Inserts events into MongoDB** with status `pending`
3. **Pushes events to a Redis queue** (`webhook:queue`)
4. **Publishes to a Redis Pub/Sub channel** (`webhook:new`)
5. **Simulates worker processing and delivery**
6. **Triggers retry logic** on delivery failures
7. **Logs status updates** such as:
   - `success`
   - `retrying`
   - `failed`

---

---


###  How to Run

```bash
node test.js
```
---

## Frontend – Webhook Monitoring Dashboard

A real-time dashboard to track and filter webhook events. Built with **React**, **TailwindCSS**, and **JWT Auth**.

---

### Tech Stack

- **React.js + Axios** – SPA + API requests
- **React Router** – Route handling
- **TailwindCSS** – UI Styling
- **JWT Auth** – Secure access with token-based sessions

---

### Features

- **Real-Time Polling**: Fetches logs every 5 seconds
- **Filtering**: By status, source, date
- **Pagination**: For large datasets
- **Login Protected**: JWT-based login
- **Responsive UI**: Mobile and desktop-friendly

---

### Setup Instructions

#### 1. Install Dependencies

```bash
cd frontend
npm install
```

#### 2. Run the Dashboard

```bash
npm run dev
```

The app will be live at: [http://localhost:3000](http://localhost:5134)

---

### Auth Flow

- **Login** via `POST /auth/login`
- **Store JWT** in `localStorage`
- **Attach Token** to all `Authorization: Bearer <token>` headers
- **Logout** clears token and redirects

---

### Logs Page

- View event logs via `GET /webhooks`
- Filtering: `?status=failed&source=github&page=1`
- Real-time: Polls API every 5 seconds
- Pagination: Controlled via query params

---

### Design Considerations

- Polling used for simplicity (replaceable with WebSocket/SSE)
- Stateless frontend via JWT
- Reusable component-based structure

---

### Improvements

- 🔄 Replace polling with WebSockets
- 🧑‍💼 Role-based access control
- 📄 Event detail view with raw payload
- 📤 Export to CSV/PDF
- 📈 Performance metrics

---
