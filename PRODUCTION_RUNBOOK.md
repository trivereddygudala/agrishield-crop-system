# AgriShield Production Operational Runbook

**Document Version:** 1.0.0 (B9.7)  
**Classification:** Internal Production Operations  
**Target Environment:** Cloud Hybrid (Vercel Frontend + Render Multi-Node Microservices + MongoDB Atlas)

---

## 1. Production Architecture & Service Topology

| Service | Public URL | Hosting Platform | Primary Workloads / Responsibilities |
| :--- | :--- | :--- | :--- |
| **Frontend SPA** | `https://agrishield-crop-system-rust.vercel.app` | Vercel Edge Network | React 18 SPA, WebSocket context, client telemetry decay ticker, multilingual UI. |
| **Main Backend** | `https://agrishield-crop-system.onrender.com` | Render Cloud (Web Service) | Authentication/JWT, MongoDB Atlas transactions, Equipment bookings, IoT device sync, Notifications & WebSocket hub, Scheduler & Watchdog. |
| **AI Worker 1** | `https://agrishield-ai-worker-1.onrender.com` | Render Cloud (Worker 1) | Primary PyTorch leaf scan diagnosis, Grad-CAM++ explainability, leaf image ingestion (`/api/upload`, `/api/predict`). |
| **AI Worker 2** | `https://agrishield-ai-worker-2.onrender.com` | Render Cloud (Worker 2) | Botanical plant & weed species identification (`/api/identify-plant`). |
| **AI Worker 3** | `https://agrishield-ai-worker-3.onrender.com` | Render Cloud (Worker 3) | Agrochemical label OCR (`/api/agrochemical*`), Crop Advisor LLM (`/api/crop-advisor`), multilingual plant translations (`/api/translate*`). |

---

## 2. Health Monitoring & Diagnostic Interpretation

### 2.1 Health Endpoints

- **Main Backend:** `GET https://agrishield-crop-system.onrender.com/health` (also mounted on `/api/v1/health`)
- **AI Workers 1, 2, 3:** `GET https://<worker-url>/health`
- **Cluster Status:** `GET https://agrishield-crop-system.onrender.com/cluster/status`

### 2.2 Diagnostic Payload Structure (B9.7)

```json
{
  "status": "healthy",
  "service": "AI Crop Disease Detection System API",
  "phase": 2,
  "docs": "/docs",
  "versioned_api": "/api/v1",
  "diagnostics": {
    "database": "connected",
    "scheduler": "running",
    "device_watchdog": "running"
  }
}
```

### 2.3 Diagnostic Health Matrix

| Metric | Normal State | Warning / Failure State | Operational Impact |
| :--- | :--- | :--- | :--- |
| `status` | `"healthy"` | `"degraded"` | Service is active, but a critical dependency is disconnected. |
| `diagnostics.database` | `"connected"` | `"disconnected"` | MongoDB Atlas connection pool unavailable; backend returns HTTP 503 (`DATABASE_UNAVAILABLE`). |
| `diagnostics.scheduler` | `"running"` | `"inactive"` | Periodic notification rules and render keep-alive tasks stopped. |
| `diagnostics.device_watchdog` | `"running"` | `"inactive"` | Stale IoT devices will not be automatically transitioned to offline. |

---

## 3. Correlation ID (`X-Request-ID`) Troubleshooting Workflow

Every request traversing the AgriShield ecosystem carries an authoritative `X-Request-ID` header.

### 3.1 Capturing the Correlation ID

1. Open Browser Developer Tools (`F12` or `Ctrl+Shift+I`).
2. Navigate to the **Network** tab.
3. Locate the failed API request (highlighted in red or returning 4xx/5xx).
4. Under **Headers -> Request Headers** or **Response Headers**, copy the `X-Request-ID` value:
   ```text
   X-Request-ID: req_1727854000000_a1b2c3d4
   ```
5. If the request failed with an HTTP 500 or 503, the correlation ID is also embedded directly in the error response body:
   ```json
   {
     "status": "error",
     "code": "DATABASE_UNAVAILABLE",
     "detail": "Database service is temporarily unavailable. Please retry in a few moments.",
     "request_id": "req_1727854000000_a1b2c3d4"
   }
   ```

### 3.2 Tracing Across Microservice Logs

Use the captured `X-Request-ID` to filter logs across Render dashboards:
1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Open the service corresponding to the endpoint called:
   - For `/api/upload` or `/api/predict` -> Check **AI Worker 1**.
   - For `/api/identify-plant` -> Check **AI Worker 2**.
   - For `/api/agrochemical*`, `/api/crop-advisor`, `/api/translate` -> Check **AI Worker 3**.
   - For all other business routes (`/api/auth`, `/api/equipment`, `/api/devices`, `/api/notifications`) -> Check **Main Backend**.
3. In the log search bar, paste the correlation ID:
   ```text
   [req_1727854000000_a1b2c3d4]
   ```
4. Correlate the exact lifecycle:
   ```text
   [AI Cluster] [req_1727854000000_a1b2c3d4] Dispatching scan to worker: https://agrishield-ai-worker-1.onrender.com
   [INTERNAL ERROR] [req_1727854000000_a1b2c3d4] POST /api/predict - TimeoutException: Worker node unresponsive
   ```

---

## 4. Incident Response & Triage Procedures

### 4.1 Frontend Blank Screen or React `ErrorBoundary`
- **Symptom:** User sees fallback UI: *"Something went wrong"* or blank screen.
- **Root Cause:** Minification collision, variable initialization before declaration (`ReferenceError`), or unhandled rendering crash.
- **Action:**
  1. Open DevTools Console and inspect the crash stack trace.
  2. If a production release caused the issue, initiate instant Vercel rollback (see Section 5).
  3. Validate `/login` and `/dashboard` with cache disabled (`Ctrl+F5`).

### 4.2 Main Backend HTTP 503 (`DATABASE_UNAVAILABLE`)
- **Symptom:** API requests return `HTTP 503 Service Unavailable` with `code: DATABASE_UNAVAILABLE`.
- **Root Cause:** MongoDB Atlas network interruption, M0 free tier paused, or IP access list expiration.
- **Action:**
  1. Verify `GET https://agrishield-crop-system.onrender.com/health` -> check `diagnostics.database`.
  2. Log in to MongoDB Atlas -> Check cluster status, connection count, and Network Access (ensure `0.0.0.0/0` is allowed for Render dynamic IPs).
  3. If Atlas is online, restart the Main Backend service via Render dashboard to flush the connection pool.

### 4.3 AI Worker Latency / HTTP 504 / Cold Starts
- **Symptom:** Crop scan, weed ID, or agrochemical OCR hangs for ~30–50 seconds before returning.
- **Root Cause:** Render Free Tier spins down inactive containers after 15 minutes of idle time. Cold boot of PyTorch / sentence-transformers takes ~35s.
- **Action:**
  1. Verify worker health endpoint: `curl -I https://agrishield-ai-worker-1.onrender.com/health`.
  2. The Main Backend keep-alive loop (`render_keepalive_loop`) automatically pings workers every 240 seconds. Check Main Backend logs for `[CLUSTER KEEPALIVE]` entries.
  3. Verify frontend cluster failover in `frontend/src/services/api.js` (Worker 2/3 failover gracefully to Worker 1 / Main Backend).

### 4.4 WebSocket Disconnect / Reconnection Loops
- **Symptom:** Notification badge fails to update live; browser network shows repeated `1006` WebSocket disconnects.
- **Action:**
  1. Confirm user JWT token validity. If token expired, client should refresh or redirect to `/login`.
  2. Confirm Main Backend Uvicorn process is healthy.
  3. Inspect WebSocket handshake headers in browser DevTools: `wss://agrishield-crop-system.onrender.com/api/v1/notifications/ws/<userId>`.

### 4.5 IoT Device Stuck "Online" or False "Offline"
- **Symptom:** ESP32 hardware is powered off, but dashboard shows ONLINE, or device transitions offline prematurely.
- **Action:**
  1. Verify `diagnostics.device_watchdog` in `/health` is `"running"`.
  2. Check device `last_seen` timestamp via `GET /api/v1/devices/status`.
  3. Authoritative threshold is exactly 90 seconds (B9.6 invariant). If `now - last_seen > 90s`, watchdog transitions node to offline on next 15-second tick.
  4. Ensure ESP32 firmware loop sends heartbeat (`POST /api/v1/devices/heartbeat`) at least once every 60 seconds.

---

## 5. Deployment Rollback Workflow

If a breaking defect is introduced in production:

### 5.1 Frontend Rollback (Vercel)
1. Navigate to [Vercel Dashboard](https://vercel.com) -> `agrishield-crop-system`.
2. Go to the **Deployments** tab.
3. Locate the previous known good deployment (e.g., B9.6 commit `7e4db92`).
4. Click the three dots (`...`) -> **Promote to Production**.
5. Traffic shifts instantly (0 seconds build time).

### 5.2 Backend Rollback (Render)
1. On local workstation, revert the breaking commit:
   ```bash
   git revert <bad-commit-sha>
   git push origin main
   ```
   *OR* point branch to previous stable commit:
   ```bash
   git push origin <stable-commit-sha>:main --force
   ```
2. Render detects webhook update and triggers clean build.
3. Monitor build progress in Render deployment logs.
4. Verify live service health:
   ```bash
   curl -s https://agrishield-crop-system.onrender.com/health | jq .
   ```

---

## 6. Architectural Invariants (B9.2 – B9.7)

The following architectural guarantees must **NEVER** be compromised in any hotfix or maintenance patch:

- **B9.2 Invariant (Database Failure Isolation):** Database degradation must always produce `HTTP 503 DATABASE_UNAVAILABLE` with `Retry-After: 5`. Database failures must never be masked as 401 Unauthorized or uncaught 500 crashes.
- **B9.3 Invariant (Image Disk Affinity):** Never failover `/api/upload` or `/api/predict` across different cluster nodes. Uploaded images reside on the local ephemeral disk of the container that received `/api/upload`.
- **B9.4 Invariant (Translation Concurrency):** Multilingual translations must leverage batch caching and asyncio concurrency.
- **B9.5A Invariant (Notification Deduplication):** WebSocket notification events and local toast alerts must use unique `notification_id` deduplication.
- **B9.5B Invariant (User Storage Isolation):** Notification caches and unread counts in `localStorage`/`sessionStorage` must remain isolated per authenticated user ID.
- **B9.6 Invariant (IoT Offline Watchdog):** 90-second authoritative threshold with single-event emission. Device A status must never overwrite Device B.
- **B9.7 Invariant (Observability & Safety):** `X-Request-ID` is diagnostic metadata only. It must never be used as an authorization token, user identifier, or database lookup key.
