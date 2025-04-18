# 📡 Webhook Delivery System – Backend

This repository contains the backend implementation of a **reliable, scalable webhook handling system** using **Node.js**, **Express**, **MongoDB**, and **Redis**. The system ensures asynchronous delivery, automatic retries, and robustness through queue-based architecture.

---

## 🧩 Features

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
npm run dev
```

---

## API Endpoints

### `POST /webhook/:source`

Receives a webhook from external systems.

**Example**:

```bash
curl -X POST http://localhost:4000/webhook/github -H "Content-Type: application/json" -d '{"message":"build success"}'
```

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
- Enable webhook signature verification.
- Add dashboard with metrics (using Grafana or Prometheus).
- Integrate rate limiting  
- Debugging with current Redis queue size and retry queue info to test in actual Real life.

---

##  Simulated the Full Backend System – test.js  

The test.js script is a self-contained simulation tool that mimics the entire webhook system workflow. It's useful for local testing, CI/CD pipelines, and demo environments to validate the complete backend logic without needing external webhook providers.  
  
What It Does  
Creates mock webhook events  

- Inserts events into MongoDB with pending status  

- Pushes events to the Redis queue (webhook:queue)  

- Publishes notifications to webhook:new (Pub/Sub)  

- Simulates worker pickup and delivery attempts  

- Triggers retry logic if delivery fails  

- Logs status updates (success, failed, etc.)  

-How to Run

node test.js

Here’s a **professionally structured and well-formatted README** for both the **backend** and **frontend** of your **Webhook Delivery System**, organized into two separate sections for clarity.

---

# Webhook Delivery System

A robust, scalable system for receiving, processing, retrying, and monitoring webhooks with real-time insights. Built with **Node.js**, **Express**, **MongoDB**, **Redis**, and **React.js**.

---

## Repository Structure

```bash
.
├── backend/       # Node.js + Redis + MongoDB webhook processor
│   └── README.md
└── frontend/      # React.js dashboard for monitoring webhooks
    └── README.md
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

The app will be live at: [http://localhost:3000](http://localhost:3000)

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