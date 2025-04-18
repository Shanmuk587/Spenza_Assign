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
npm run dev (both for backend and frontend)
```

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

## 🧪 Testing & Debugging

- Webhook events are logged in MongoDB.
- Enable verbose logs in `webhookWorker.js` to see delivery attempts and retries.

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

##  Simulated the Full Backend System – test.js  

The test.js script is a self-contained simulation tool that mimics the entire webhook system workflow. It's useful for local testing, CI/CD pipelines, and demo environments to validate the complete backend logic without needing external webhook providers.  
  
🔁 What It Does  
Creates mock webhook events  

- Inserts events into MongoDB with pending status  

- Pushes events to the Redis queue (webhook:queue)  

- Publishes notifications to webhook:new (Pub/Sub)  

- Simulates worker pickup and delivery attempts  

- Triggers retry logic if delivery fails  

- Logs status updates (success, failed, etc.)  

-How to Run

node test.js



🔮 Webhook Dashboard Frontend
This is the frontend interface for the Webhook Processing System, built to monitor webhook events in real-time with support for filtering, pagination.

It connects to the backend system via RESTful APIs and provides a user-friendly way to track, filter, and inspect webhook event logs.

🚀 Features
📡 Real-Time Polling: Automatically fetches new webhook logs every few seconds to reflect live system activity.

🔎 Advanced Filtering: Filter events by:

✅ Status (pending, success, failed, etc.)

🌐 Source (e.g., github, stripe, etc.)

📄 Pagination: Efficient loading and navigation of logs across large datasets.

🔐 Authentication & Authorization:

Uses JWT-based login flow

Role-based access if implemented on backend

🌗 Responsive UI: Designed for both desktop and mobile usability.

🧰 Tech Stack
React.js + Axios – SPA and API communication

React Router – Routing and navigation

JWT Auth – Secured login and token-based session handling

TailwindCSS – Simple UI styling (update based on what you used)

React Hooks – State and side effects (e.g. polling)


📥 Install dependencies
bash
Copy
Edit
npm install
🔑 Environment Setup
Create a .env file:

env
Copy
Edit
REACT_APP_API_URL=http://localhost:5000/api
▶️ Run the App
bash
Copy
Edit
npm run dev
The app will be available at: http://localhost:3000

🔐 Auth Flow
Login with credentials (calls POST /auth/login)

JWT is stored in localStorage

All API requests are made with Authorization: Bearer <token>

Protected routes require token validation

Logout clears token and redirects to login

📊 Logs Dashboard
Webhooks are fetched via /webhooks?status=pending&source=github&page=2

Polling happens every 5 seconds to reflect real-time status updates

Retry, success, and permanently failed events are visibly tagged

Pagination limit can be configured via query params

✨ Design Considerations
Polling vs WebSocket: Chose polling for simplicity and compatibility across platforms (can scale to SSE or WebSockets later)

JWT Auth: Keeps the frontend stateless and scalable

Component-based UI: Ensures maintainability and reusability

🧪 Future Improvements
Migrate polling to WebSocket or Server-Sent Events (SSE) for better efficiency

Add role-based dashboard views

Implement event detail modal with raw payload

Add export to CSV/PDF feature

🤝 Integration
Make sure your backend exposes endpoints like:

POST /auth/login

GET /webhooks

GET /webhooks/:id

GET /sources – for filter dropdown

All endpoints should validate JWT token in Authorization header