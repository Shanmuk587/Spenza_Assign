# 📡 Webhook Delivery System – Backend

This repository contains the backend implementation of a **reliable, scalable webhook handling system** using **Node.js**, **Express**, **MongoDB**, and **Redis**. The system ensures asynchronous delivery, automatic retries, and robustness through queue-based architecture.

---

## 🧩 Features

- ✅ Immediate HTTP 202 response to incoming webhooks
- 📦 Queue-based processing using Redis (List & Pub/Sub)
- 🔁 Exponential retry logic via Redis Sorted Set (ZSET)
- 🧠 Persistent storage of webhook events in MongoDB
- 📊 Monitoring & recovery support
- 🚀 Scalable architecture supporting distributed workers

---

## 🏗️ Architecture Overview

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

## 🧠 Design Choices & Architecture

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

## ⚙️ Getting Started

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
PORT=4000
MONGO_URI=mongodb://localhost:27017/webhooks
REDIS_URL=redis://localhost:6379
MAX_RETRIES=5
RETRY_BASE_DELAY=5000 # in milliseconds
```

---

### 4. Start the services

#### Start the main server (API and worker):

```bash
npm run start
```

#### Optional: Run retry worker separately

```bash
node retryWorker.js
```

> You can also use a process manager like PM2 for production deployment and scaling.

---

## 📬 API Endpoints

### `POST /webhook/:source`

Receives a webhook from external systems.

**Example**:

```bash
curl -X POST http://localhost:4000/webhook/github -H "Content-Type: application/json" -d '{"message":"build success"}'
```

### `GET /debug/status`

Returns current Redis queue size and retry queue info.

---

## 📁 Project Structure

```
.
├── controllers/
│   └── webhookController.js
├── workers/
│   ├── webhookWorker.js
│   └── retryWorker.js
├── models/
│   └── WebhookEvent.js
├── redis/
│   └── index.js
├── routes/
│   └── webhookRoutes.js
├── utils/
│   └── retryUtils.js
├── .env
├── server.js
├── package.json
└── README.md
```

---

## 🧪 Testing & Debugging

- Use `GET /debug/status` to inspect queue lengths.
- Webhook events are logged in MongoDB.
- Enable verbose logs in `webhookWorker.js` to see delivery attempts and retries.

---

## 🖥 Frontend

The companion frontend is available in a separate repository:
🔗 [Frontend Repo](https://github.com/your-username/webhook-frontend)

It visualizes webhook events and their statuses, providing an interface to inspect delivery history and retry outcomes.

---

## 🔐 Security Notes

- Validate source IPs or use secrets for authenticating incoming webhooks.
- Limit retries to avoid infinite loops or webhook flooding.
- Use HTTPS endpoints for secure delivery.

---

## 🏁 Improvements

- Add dead-letter queue (DLQ) for manual inspection of permanently failed events.
- Enable webhook signature verification.
- Add dashboard with metrics (using Grafana or Prometheus).
- Integrate rate limiting 

---

## 👨‍💻 Author

**Shanmukesh** – [@shanmuk361](https://github.com/shanmuk361)  
Feel free to connect for collaboration or questions.

---

Let me know if you want a matching `README.md` for the frontend or a diagram to include!