# AGRISHIELD — MASTER VERIFICATION, REMEDIATION & ROADMAP (PHASES B1 — B12)

**Project:** AgriShield AI Crop Disease Detection, IoT Telemetry & Farm Machinery Ecosystem  
**Document Classification:** Master Project Architecture & Verification Plan  
**Rules:** Strictly Read-Only Audit & Roadmap Baseline. Zero Application Code Changes.  
**Baseline Date:** September 28, 2026  

---

## EXECUTIVE ROADMAP OVERVIEW

This document establishes the single source of truth for all current verification audits, discovered defects, security vulnerabilities, distributed workload designs, and phased implementations across the AgriShield distributed platform.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 AGRISHIELD MASTER PHASES                                 │
├──────────────────────────┬───────────────────────────┬───────────────────────────────────┤
│ B1: Booking Ecosystem   │ B5: Provider Portal E2E   │ B9: AI Deep Audit (Post Oct 1)    │
│ B2: Comms & Realtime    │ B6: Admin Portal E2E      │ B10: Render Workload Architecture │
│ B3: Security & Isolation │ B7: IoT Telemetry & Alerts│ B11: Load, Failure & Resilience   │
│ B4: Farmer Portal E2E   │ B8: Multilingual Systems  │ B12: Advanced Upgrades & Features │
└──────────────────────────┴───────────────────────────┴───────────────────────────────────┘
```

---

## PHASE B1 — BOOKING ECOSYSTEM

### 1. Objective
Achieve an enterprise-grade, concurrency-safe, multi-tenant machinery rental engine supporting realistic scheduling, collision prevention, distance calculations, and atomic provider decision-making across Farmers and Equipment Providers.

### 2. What Must Be Audited
- Backend booking router endpoints (`/bookings`, `/catalog`, `/fleet`, `/chat/messages`).
- Calendar slot collision detection and date boundary validations.
- Optimistic UI state vs authoritative server persistence.
- Concurrency, simultaneous acceptance, and double-click race conditions.
- Provider decision information architecture (distance, terrain, implements, notes).

### 3. Important Real-World Scenarios
- **Scenario B1-01:** Three farmers simultaneously request `TRACTOR-A` for the same date and overlapping time slot.
- **Scenario B1-02:** Provider opens two browser tabs and accepts Farmer 1 in Tab A and Farmer 2 in Tab B simultaneously.
- **Scenario B1-03:** Farmer submits booking during network disconnection; system must handle retry cleanly without phantom booking or silent loss.
- **Scenario B1-04:** Double-click submission on slow 3G network; duplicate booking prevention.
- **Scenario B1-05:** Farmer cancels confirmed booking 1 hour prior to job; provider notification and schedule release.

### 4. Known Findings (From Phase B1 Audit)

#### P0 — CRITICAL
- **FIND-B1-01 (SECURITY / BOLA):** Complete absence of authentication on all 14 equipment booking endpoints (`backend/app/routers/provider/equipment.py`). No `Depends(get_current_user)` checks exist.
- **FIND-B1-02 (DATA INTEGRITY):** Total absence of a calendar date/time-slot availability engine. Availability is tracked purely as a static boolean flag (`available: true/false`).
- **FIND-B1-03 (CONCURRENCY):** Zero atomic check-and-set or distributed locking. Overlapping bookings for the same machine can both be marked `confirmed`.
- **FIND-B1-04 (INFRASTRUCTURE):** Main Production Backend on Render (`https://agrishield-crop-system.onrender.com`) returns `404 Not Found` for all `/api/v1/equipment/*` routes because the router is not deployed to the main instance.
- **FIND-B1-05 (SECURITY / ISOLATION):** Complete lack of tenant isolation in UI queries (`ProviderDashboardPage.jsx` and `EquipmentBookingPage.jsx`). All bookings of all farmers across India are returned and visible to any client.

#### P1 — HIGH
- **FIND-B1-06 (DATA INTEGRITY):** False success on network timeout. `localStorage` saves optimistically before API succeeds; poller purges the local record after 45 seconds, causing silent booking loss.
- **FIND-B1-07 (UX / DATA INTEGRITY):** Double-click booking creation creates duplicate bookings with distinct random IDs.
- **FIND-B1-08 (REALTIME):** `WebSocketContext.jsx` ignores `booking_status_updated` and `booking_chat_message` events.
- **FIND-B1-09 (ARCHITECTURE):** Status cancellation notifications are sent to the Farmer instead of the Provider.
- **FIND-B1-10 (DATA INTEGRITY):** Client voucher deletion registers permanent tombstone in `SyncService`, wiping the booking record cluster-wide.

#### P2 — MEDIUM
- **FIND-B1-11 (UX / SCHEDULING):** Provider order card lacks distance, approach road status, and special farmer instructions.
- **FIND-B1-12 (SCHEDULING):** Missing `min` date constraint in modal; UTC midnight boundary creates off-by-one day error in IST.
- **FIND-B1-13 (ADMIN):** Zero admin visibility into equipment bookings, disputes, or equipment revenue.
- **FIND-B1-14 (TESTING):** 0% automated test coverage in pytest suite for equipment bookings.

### 5. Dependencies
- Depends on `User` authentication tokens (Phase B3).
- Feeds into Notification Service & WebSocket routing (Phase B2).

### 6. Current Status
**AUDITED — NOT READY FOR PRODUCTION (Implementation Not Started)**

### 7. Fix Groups
- **B1-FIX-A (Security & RBAC):** Implement Pydantic request/response schemas, inject `Depends(get_current_user)`, enforce tenant isolation filters.
- **B1-FIX-B (Infrastructure & Deployment):** Mount router in live `main.py` on Main Backend Render deployment.
- **B1-FIX-C (Availability & Concurrency Engine):** Compound unique indexing on `(equipment_id, booking_date, time_slot)` where `status='confirmed'`, atomic state transition transactions, automatic decline/warning for competing requests.
- **B1-FIX-D (Real-Time WebSockets & Notifications):** Wire `booking_status_updated` into `WebSocketContext.jsx`; fix cancellation recipient resolution.
- **B1-FIX-E (UX & Network Resiliency):** Add submit button debouncing, idempotency keys, explicit error toasts, render distance and road accessibility.

### 8. Testing Required
- Pytest suite covering single booking, competing bookings, atomic acceptance, unauthorized access rejection (HTTP 401/403).
- High-concurrency race condition simulator (5 simultaneous acceptances).

### 9. Production Verification Required
- Verify `https://agrishield-crop-system.onrender.com/api/v1/equipment/bookings` returns HTTP 200 with tenant-scoped records.
- End-to-end multi-device booking test between real Farmer and Provider accounts.

### 10. Deployment Requirements
- Backend redeploy to Main Render service and Workers 1 & 2.
- MongoDB compound index migration on `equipment_bookings`.
- Vercel frontend rebuild.

### 11. What Must NOT Be Changed
- Local fallback structures for rural offline resilience.
- Canonical starter fleet listings.
- 13-language translation pipeline and glossary mappings.

### 12. Final Completion Criteria
- Zero unauthenticated equipment endpoints.
- Two overlapping bookings cannot both enter `confirmed` state under any circumstances.
- Main backend serves equipment routes directly.

---

## PHASE B2 — COMMUNICATION / NOTIFICATIONS / REALTIME / HELPDESK

### 1. Objective
Establish reliable, bidirectional real-time communication across Farmer, Provider, and Admin roles, encompassing in-app notifications, WebSockets, FCM push notifications, direct equipment chat, and support helpdesk ticketing.

### 2. What Must Be Audited
- `backend/app/routers/common/notifications.py` and `NotificationService`.
- WebSocket connection lifecycle, token expiration during active sessions, and heartbeat reconnection.
- Direct equipment chat messaging (`/api/v1/equipment/bookings/{id}/messages`).
- Helpdesk ticket dispatch and support chatbot routing (`/api/support`).
- Notification category filtering, role-aware unread counts, and quiet hours.

### 3. Important Real-World Scenarios
- **Scenario B2-01:** WebSocket disconnects due to mobile cell tower switch; auto-reconnect without duplicate socket leaks.
- **Scenario B2-02:** Farmer sends message in Telugu; Provider receives and views message in English or Telugu with original text preserved.
- **Scenario B2-03:** High-priority equipment dispatch notification triggers while user has another modal open.
- **Scenario B2-04:** Helpdesk ticket submitted by farmer is routed to Admin with linked diagnostic scan or booking voucher ID.

### 4. Known Findings
- **BUG (P1):** `WebSocketContext.jsx` ignores `booking_status_updated` and `booking_chat_message` incoming WebSocket packets.
- **ARCHITECTURE (P1):** Provider dashboard relies on polling; does not maintain persistent WebSocket listener.
- **SECURITY (P0):** Equipment chat messaging endpoints allow unauthenticated reading, editing, and deletion of private messages.
- **DATA INTEGRITY (P2):** Support tickets in `support.py` lack foreign key linkage (`booking_id`, `prediction_id`).

### 5. Dependencies
- Depends on Phase B3 (Authentication/RBAC) for socket handshake authorization.

### 6. Current Status
**NOT STARTED**

### 7. Fix Groups
- **B2-FIX-A:** WebSocket client event listener normalization in `WebSocketContext.jsx`.
- **B2-FIX-B:** Secure chat endpoints with participant authorization.
- **B2-FIX-C:** Helpdesk schema expansion to link bookings and crop diagnostics.

### 8. Testing Required
- WebSocket connection drop and resume testing.
- Cross-language message transmission verification.

### 9. Production Verification Required
- Verify WebSocket handshake over WSS on Render production domain.
- Test multi-tab notification badge synchronization.

### 10. Deployment Requirements
- Backend deployment; frontend Vercel deployment.

### 11. What Must NOT Be Changed
- Quiet hours evaluation engine and FCM push delivery.
- Role-based notification category whitelisting.

### 12. Final Completion Criteria
- Real-time messages deliver within 500ms between Farmer and Provider.
- Zero unauthenticated chat access.

---

## PHASE B3 — SECURITY + DATA ISOLATION

### 1. Objective
Implement robust tenant isolation, eliminate Broken Object-Level Authorization (BOLA/IDOR), harden JWT authentication, enforce strict role-based access control (RBAC), and prevent unauthorized cross-user data leakage.

### 2. What Must Be Audited
- JWT validation across all routers and sub-routers.
- User ID and tenant scoping on all query filters (`find({"user_id": current_user["id"]})`).
- Storage token persistence (`sessionStorage` vs `localStorage`).
- Sensitive data exposure in logs and API error responses.
- CORS policy and security headers middleware.

### 3. Important Real-World Scenarios
- **Scenario B3-01:** Farmer A alters request payload ID to view or cancel Farmer B’s booking (IDOR test).
- **Scenario B3-02:** Provider A attempts to delete Provider B’s tractor listing.
- **Scenario B3-03:** Anonymous user attempts to download full database booking dump.
- **Scenario B3-04:** Expired token renewal under low network bandwidth.

### 4. Known Findings
- **SECURITY (P0):** Universal BOLA vulnerability in equipment router (`equipment.py`).
- **SECURITY (P0):** Universal data dump vulnerability in `GET /api/v1/equipment/bookings?limit=2500`.
- **SECURITY (P1):** Raw `Dict[str, Any]` body parameters allow mass assignment of unauthorized fields.

### 5. Dependencies
- Foundation for all Portal E2E phases (B4, B5, B6).

### 6. Current Status
**NOT STARTED**

### 7. Fix Groups
- **B3-FIX-A:** Global authentication dependency injection across all equipment and catalog endpoints.
- **B3-FIX-B:** Tenant filter enforcement (Farmer sees only own bookings; Provider sees only own fleet orders).
- **B3-FIX-C:** Pydantic strict schema input validation.

### 8. Testing Required
- Automated RBAC security matrix test suite covering anonymous, farmer, provider, and admin access on every endpoint.

### 9. Production Verification Required
- Penetration smoke tests for unauthorized IDOR parameter tampering.

### 10. Deployment Requirements
- Backend deployment across all Render instances.

### 11. What Must NOT Be Changed
- `SecurityHeadersMiddleware` configuration in `main.py`.
- Password hashing and argon2/bcrypt token logic.

### 12. Final Completion Criteria
- 100% of non-public endpoints return HTTP 401 when called without a valid JWT.
- Zero cross-tenant data leakage.

---

## PHASE B4 — FARMER PORTAL END-TO-END

### 1. Objective
Audit and verify the complete end-to-end farmer journey from onboarding, crop profile configuration, disease diagnosis, treatment prescriptions, equipment booking passbook, to khata ledger management.

### 2. What Must Be Audited
- `DashboardPage.jsx`, `UploadImagePage.jsx`, `PredictionResultPage.jsx`, `HistoryPage.jsx`.
- `CropGrowthTimeline.jsx`, `FieldAreaCalculatorPage.jsx`, `MarketPricesPage.jsx`.
- Farm Profile completion validation and active farm context switching.
- Offline synchronization of crop health records.

### 3. Important Real-World Scenarios
- **Scenario B4-01:** Farmer with 3 registered fields uploads leaf photo; diagnosis correctly links to active field.
- **Scenario B4-02:** Farmer calculates field acreage using GPS polygon tool; acreage seamlessly transfers to booking modal.
- **Scenario B4-03:** Farmer switches preferred language from English to Telugu; diagnosis, prescriptions, and vouchers update instantly.

### 4. Known Findings
- **UX / STATE (P1):** False confirmation toast on equipment booking when backend times out.
- **DATA INTEGRITY (P2):** Farm profile completion flag inconsistency during quick-register flow.

### 5. Dependencies
- Depends on B1 (Booking), B3 (Security), and B8 (Multilingual).

### 6. Current Status
**NOT STARTED**

### 7. Fix Groups
- **B4-FIX-A:** Farmer state unification and active farm profile persistence.
- **B4-FIX-B:** Prescription PDF export and offline sync hardening.

### 8. Testing Required
- End-to-end Cypress/Playwright flow from login to leaf scan to equipment reservation.

### 9. Production Verification Required
- Live verification on mobile Chrome/Safari browsers under throttled network conditions.

### 10. Deployment Requirements
- Frontend Vercel deployment.

### 11. What Must NOT Be Changed
- Plantix-style visual cards and farmer-first high contrast UI design.
- Local GPS calculation algorithms.

### 12. Final Completion Criteria
- Complete farmer flow operates with zero console exceptions and zero data loss on network drops.

---

## PHASE B5 — EQUIPMENT PROVIDER PORTAL END-TO-END

### 1. Objective
Audit and verify the complete equipment provider lifecycle: machinery registration, fleet catalog sync, incoming rental order management, operator dispatch, settlement calculations, and revenue analytics.

### 2. What Must Be Audited
- `ProviderDashboardPage.jsx` (Fleet, Orders, Earnings, Copilot tabs).
- Machinery catalog upsert and deletion endpoints (`/catalog`).
- Fleet availability toggle (`/fleet/{id}/availability`).
- Earnings ledger calculation and completed job settlement.

### 3. Important Real-World Scenarios
- **Scenario B5-01:** Provider registers new 50HP tractor with 2 implements; instantly appears in local mandal catalog.
- **Scenario B5-02:** Provider receives 5 competing bookings for different dates; accepts each without false global lockouts.
- **Scenario B5-03:** Provider marks job completed; earnings aggregate updates immediately without page reload.

### 4. Known Findings
- **BUG (P0):** Provider dashboard displays orders belonging to other providers across India.
- **BUG (P1):** Accepting a single booking disables the entire machine globally across all dates.
- **UX (P2):** Order cards omit distance (km), road access, and farmer instructions.

### 5. Dependencies
- Depends on B1 (Booking Engine) and B3 (Security).

### 6. Current Status
**NOT STARTED**

### 7. Fix Groups
- **B5-FIX-A:** Scoped provider query filtering (`provider_phone` / `provider_id`).
- **B5-FIX-B:** Date-specific fleet availability state management.
- **B5-FIX-C:** Order dossier expansion (distance, terrain, attachments).

### 8. Testing Required
- Provider ledger reconciliation test (total earnings vs sum of completed bookings).

### 9. Production Verification Required
- Verify provider fleet edits persist to MongoDB Atlas and sync across mobile and desktop.

### 10. Deployment Requirements
- Frontend Vercel and Backend Render deployments.

### 11. What Must NOT Be Changed
- Rapid 1-tap Accept/Decline action buttons.
- Direct WhatsApp and telephone dialer quick-links.

### 12. Final Completion Criteria
- Provider manages only their own fleet and incoming orders with complete logistical context.

---

## PHASE B6 — ADMIN PORTAL END-TO-END

### 1. Objective
Audit and verify the system administrator console for user management, role elevation, cluster health monitoring, OTA firmware rollout, dispute resolution, and platform-wide audit logging.

### 2. What Must Be Audited
- `AdminPage.jsx` and `backend/app/routers/admin/admin.py`.
- User role modification endpoint (`PATCH /admin/users/{id}/role`).
- Cluster worker status endpoint (`/cluster/status`).
- OTA firmware binary validation and rollout triggers.
- Support ticket resolution and broadcast announcements.

### 3. Important Real-World Scenarios
- **Scenario B6-01:** Admin elevates registered farmer to `equipment_provider`; user permissions update immediately.
- **Scenario B6-02:** Admin inspects distributed AI worker nodes during peak load; worker status reflects true health.
- **Scenario B6-03:** Admin reviews equipment booking dispute between farmer and provider.

### 4. Known Findings
- **ARCHITECTURE (P2):** Admin portal completely lacks an equipment booking management and dispute view.
- **DATA INTEGRITY (P2):** Support tickets cannot be filtered by linked booking or diagnostic scan ID.

### 5. Dependencies
- Depends on B1, B2, and B3.

### 6. Current Status
**NOT STARTED**

### 7. Fix Groups
- **B6-FIX-A:** Admin fleet and booking voucher inspection panel.
- **B6-FIX-B:** Unified audit trail for critical administrative mutations.

### 8. Testing Required
- Role escalation security tests (ensure non-admin cannot access `/admin/*`).

### 9. Production Verification Required
- Verify admin dashboard loads cluster telemetry from all 3 worker nodes.

### 10. Deployment Requirements
- Frontend and backend updates.

### 11. What Must NOT Be Changed
- OTA firmware checksum verification and security wall blocking rules.

### 12. Final Completion Criteria
- Admin possesses complete oversight of users, fleet assets, rental vouchers, and hardware nodes.

---

## PHASE B7 — IOT + ALERTS

### 1. Objective
Audit and verify solar-powered ESP32 sensor node telemetry ingestion, SD card offline queuing, threshold evaluation, real-time alert triggers, and firmware over-the-air updates.

### 2. What Must Be Audited
- `backend/app/routers/iot.py`, `devices.py`, and `firmware.py`.
- Sensor telemetry ingestion pipeline (soil moisture, NPK, temperature, humidity, lux).
- Batch offline queue flush when connectivity restores.
- Notification rule trigger engine and telemetry WebSocket broadcast.

### 3. Important Real-World Scenarios
- **Scenario B7-01:** Field node loses cellular connection for 12 hours; flushes 720 readings on reconnect with zero data corruption.
- **Scenario B7-02:** Soil moisture drops below critical 20% threshold; system triggers high-priority irrigation alert.
- **Scenario B7-03:** Node battery reaches critical 3.3V; low power alert dispatched to farmer.

### 4. Known Findings
- **INFRASTRUCTURE (P2):** Ingest buffer lock contention under high-frequency batch flushes.
- **DATA INTEGRITY (P2):** Timezone normalization between ESP32 epoch time and server UTC.

### 5. Dependencies
- Feeds into Phase B2 (Notifications & Alerts).

### 6. Current Status
**NOT STARTED**

### 7. Fix Groups
- **B7-FIX-A:** Telemetry batch ingest optimization with bulk MongoDB operations.
- **B7-FIX-B:** Device heartbeats and offline status detection sentinel.

### 8. Testing Required
- Simulated ESP32 multi-node ingestion test (10 concurrent nodes transmitting every 5 seconds).

### 9. Production Verification Required
- Live telemetry stream verification on `DevicesPage.jsx`.

### 10. Deployment Requirements
- Backend deployment; firmware binary hosting verification.

### 11. What Must NOT Be Changed
- ESP32 hardware pinouts and sleep cycle power budget.
- Security walls IP rate-limiting for hardware telemetry endpoints.

### 12. Final Completion Criteria
- Telemetry ingestion sustains 100% data integrity with sub-second alert generation on threshold breaches.

---

## PHASE B8 — FULL MULTILINGUAL VERIFICATION

### 1. Objective
Audit and verify complete, end-to-end language parity across all 13 canonical Indian languages + English, ensuring zero untranslated UI leaks, zero translation distortion of technical identifiers, and reliable offline glossary fallbacks.

### 2. What Must Be Audited
- Translation pipeline across all 13 languages: `en`, `hi`, `te`, `ta`, `kn`, `ml`, `mr`, `gu`, `pa`, `bn`, `ur`, `or`, `as`.
- `frontend/src/i18n/translations.js` and `frontend/src/utils/notificationTranslator.js`.
- `backend/app/services/translation_service.py` and `COMMON_GLOSSARY`.
- AI diagnostic outputs, prescription advice, and chemical recommendations.

### 3. Important Real-World Scenarios
- **Scenario B8-01:** Farmer selects Tamil (`ta`); diagnosis, severity, chemical names, and spray timings display in accurate Tamil.
- **Scenario B8-02:** Provider receives booking voucher in Punjabi (`pa`); voucher ID, phone number, and acre count remain intact.
- **Scenario B8-03:** Google Translator API rate-limited; system falls back gracefully to in-memory agricultural glossary.

### 4. Known Findings
- **UX (P2):** Dynamic translator occasionally translates booking voucher IDs (e.g. `BK-18492` converted to non-Latin numerals).
- **COVERAGE (P2):** Secondary modals in deep portal views exhibit occasional English fallthrough text.

### 5. Dependencies
- Pervasive across all frontend and notification phases.

### 6. Current Status
**NOT STARTED**

### 7. Fix Groups
- **B8-FIX-A:** Entity protection regex ensuring numbers, currency, IDs, and chemical formulas bypass translation.
- **B8-FIX-B:** Complete coverage audit for secondary modals.

### 8. Testing Required
- Automated 13-language string parity and token preservation tests.

### 9. Production Verification Required
- Verification of dynamic translation cache in MongoDB Atlas.

### 10. Deployment Requirements
- Frontend and backend deployments.

### 11. What Must NOT Be Changed
- 13 canonical language ISO code standard.
- User profile multi-language selection priority structure.

### 12. Final Completion Criteria
- 100% UI translation coverage with zero identifier corruption across all 13 languages.

---

## PHASE B9 — AI DEEP AUDIT + ACCURACY (PLANNED POST-OCTOBER 1)

### 1. Objective
Execute a comprehensive, production-grade audit of AI diagnostic accuracy, PyTorch model execution, NVIDIA NIM Llama 3.1 agronomic advisory integration, Grad-CAM++ explainability heatmaps, uncertainty quantification, and multi-leaf batch inference.

> **SCHEDULE NOTE:** Phase B9 is explicitly scheduled to commence **after October 1, 2026**, when monthly Render container compute bandwidth and GPU quota renew.

### 2. What Must Be Audited
- PyTorch MobileNetV3 / EfficientNet crop disease classification pipeline.
- Species plant identification (`/api/identify-plant`) and agrochemical label OCR OCR (`/api/agrochemical`).
- NVIDIA NIM Llama 3.1 farming assistant prompts, agronomic advice validity, and CIBRC compliance.
- Grad-CAM++ heatmap generation, latency, and base64 memory overhead.
- Fallback ensemble architecture when external inference APIs time out.

### 3. Important Real-World Scenarios
- **Scenario B9-01:** Farmer submits blurry leaf photo in low light; uncertainty quantification alerts farmer to retake image rather than guessing.
- **Scenario B9-02:** Severe early blight detected on tomato; system recommends ICAR-compliant chemical and organic treatment schedules.
- **Scenario B9-03:** Multi-leaf field scan (5 photos); system synthesizes overall field plot disease severity index.

### 4. Known Findings
- **PERFORMANCE (P2):** Grad-CAM++ computation creates CPU spikes on 512MB free-tier Render instances during concurrent scans.
- **ARCHITECTURE (P2):** AI model weights reload latency upon cold-start container spin-up.

### 5. Dependencies
- Requires renewed Render compute allocation (October 1).
- Feeds into Phase B10 (Workload Separation).

### 6. Current Status
**NOT STARTED — SCHEDULED POST-OCTOBER 1**

### 7. Fix Groups
- **B9-FIX-A:** Model inference optimization (quantization / ONNX runtime).
- **B9-FIX-B:** Agronomic prompt template safety tuning for ICAR/CIBRC compliance.

### 8. Testing Required
- Benchmark evaluation on 1,000-image agricultural validation dataset.

### 9. Production Verification Required
- Verify diagnostic inference latency remains under 2.5 seconds on Worker 3.

### 10. Deployment Requirements
- Worker node model weights deployment.

### 11. What Must NOT Be Changed
- ICAR chemical pesticide dosage guidelines and safety precautions.
- Grad-CAM++ explainability visualization pipeline.

### 12. Final Completion Criteria
- Diagnostic accuracy verified > 95% on primary crop classes with sub-3s response times.

---

## PHASE B10 — DISTRIBUTED RENDER ARCHITECTURE / WORKLOAD SEPARATION

### 1. Objective
Architect and implement optimal, resilient workload distribution across all available Render accounts and instances, guaranteeing zero single-point-of-failure, zero cold-start bottlenecks, and clean separation between transactional, real-time, and AI-heavy workloads.

### 2. What Must Be Audited
- Current node roles and endpoint routing:
  - Main Backend: `https://agrishield-crop-system.onrender.com`
  - Worker 1: `https://agrishield-ai-worker-1.onrender.com`
  - Worker 2: `https://agrishield-ai-worker-2.onrender.com`
  - Worker 3: `https://agrishield-ai-worker-3.onrender.com`
- Client intelligent cluster router (`getTargetClusterNode` in `api.js`).
- CORS configurations, domain routing, and inter-service health pings.
- Render account quota utilization and sleep prevention keep-alive pulses.

### 3. Important Real-World Scenarios
- **Scenario B10-01:** AI Worker 3 exhausts memory during large batch scan; Main Backend continues processing bookings and IoT telemetry without disruption.
- **Scenario B10-02:** Main Backend restarts; frontend automatically fails over to active worker for catalog and booking reads.
- **Scenario B10-03:** New user registers on mobile; request routes cleanly to the primary transactional node.

### 4. Known Findings
- **INFRASTRUCTURE (P0):** Main Backend currently returns 404 for equipment endpoints; frontend relies on undocumented component-level fallbacks.
- **CONFIGURATION (P1):** Discrepancy between client cluster router targets and live container route registrations.

### 5. Dependencies
- Integrates findings from B1 (Booking Routing) and B9 (AI Compute Profiling).

### 6. Current Status
**NOT STARTED — WORKLOAD DISTRIBUTION DESIGN PENDING**

### 7. Fix Groups
- **B10-FIX-A (Router Alignment):** Synchronize route definitions so Main Backend serves transactional APIs (Auth, Equipment, Bookings, Farms, Support).
- **B10-FIX-B (AI Offloading):** Dedicate Worker 3 exclusively to PyTorch inference, OCR, and Plant ID.
- **B10-FIX-C (High-Availability Failover):** Workers 1 & 2 configured as active read-replicas / standby hot-spares with dynamic client failover.

### 8. Testing Required
- Chaos simulation: kill Main Backend and verify frontend automatically reads catalog from fallback workers.

### 9. Production Verification Required
- Verify all 4 nodes respond to `/health` and report consistent role definitions via `/cluster/status`.

### 10. Deployment Requirements
- Coordinated configuration and environment variable synchronization across all Render dashboards.

### 11. What Must NOT Be Changed
- The 4-minute pre-warming keep-alive pulse mechanism in `App.jsx`.

### 12. Final Completion Criteria
- Clear, documented workload separation across all Render services with zero 404 route mismatches.

---

## PHASE B11 — PERFORMANCE / LOAD / FAILURE / RESILIENCE

### 1. Objective
Stress-test and harden the platform against extreme real-world conditions: high-volume booking spikes, spotty 2G/3G connectivity, database failovers, container restarts, and cache invalidation races.

### 2. What Must Be Audited
- MongoDB Atlas connection pooling, cursor timeouts, and index usage.
- In-memory cache memory caps (`_MEMORY_CACHE` max size enforcement).
- Client bundle size, chunk loading retries (`lazyWithRetry.js`), and asset compression.
- Render ephemeral disk recovery and tombstone synchronization.

### 3. Important Real-World Scenarios
- **Scenario B11-01:** 500 farmers book harvesting machinery on the same morning during monsoon alert.
- **Scenario B11-02:** Database experiences 5-second connection timeout; application handles reconnect without dropping transactions.
- **Scenario B11-03:** Mobile browser cache cleared; app rehydrates critical profile and booking data in < 2 seconds.

### 4. Known Findings
- **PERFORMANCE (P2):** `GET /bookings?limit=2500` returns uncompressed payload over 1.8MB on large databases.
- **DATA INTEGRITY (P1):** Reliance on ephemeral container disk JSON files during MongoDB offline events.

### 5. Dependencies
- Requires completion of core bug fixes in B1, B2, B3, and B10.

### 6. Current Status
**NOT STARTED**

### 7. Fix Groups
- **B11-FIX-A:** Pagination and server-side cursor streaming for large booking and telemetry queries.
- **B11-FIX-B:** Connection pool tuning and circuit-breaker patterns for external APIs.

### 8. Testing Required
- Locust / k6 load test simulating 200 concurrent users performing mixed booking and diagnostic actions.

### 9. Production Verification Required
- Verify Lighthouse mobile performance score > 85 on Vercel deployment.

### 10. Deployment Requirements
- Production environment tuning.

### 11. What Must NOT Be Changed
- Service Worker caching strategies for core offline assets.

### 12. Final Completion Criteria
- Platform handles 200 concurrent active users with p95 API response times under 800ms.

---

## PHASE B12 — NEW FEATURES + ADVANCED UPGRADES

### 1. Objective
Design and implement high-value future enhancements to elevate AgriShield from a functional prototype into an industry-leading agricultural operating system.

### 2. Candidate Upgrades & Enhancements
1. **Interactive Visual Slot Calendar:** Dynamic morning/afternoon/hourly heatmap showing real-time tractor availability.
2. **GPS Route & Transit Cost Estimator:** Haversine distance and diesel transit cost calculator for machinery travelling between villages.
3. **Digital Escrow & Kisan Payments:** UPI / Razorpay / Kisan Credit Card digital escrow holding rental fees until farmer signs off on completed job.
4. **Autonomous Drone Fleet Mission Planner:** Automated flight path generation from field boundary polygon coordinates.
5. **Government Subsidy & CHC Integration:** Direct integration with state Custom Hiring Center (CHC) subsidy verification portals.
6. **Smart Voice Booking Assistant:** Voice-driven booking in Telugu and Hindi for non-literate farmers.

### 3. Important Real-World Scenarios
- **Scenario B12-01:** Farmer speaks into phone: *"I need a 50HP tractor for 3 acres tomorrow morning in Pasupugallu"*; system prepares booking voucher automatically.
- **Scenario B12-02:** Escrow holds ₹2,500; releases automatically when operator finishes field rotavation and farmer approves voucher.

### 4. Dependencies
- Strictly contingent upon successful completion and production stability of Phases B1 through B11.

### 5. Current Status
**PLANNED / FUTURE ENHANCEMENTS — NOT STARTED**

### 6. What Must NOT Be Changed
- Core simplicity of the 1-tap farmer booking flow must not be cluttered by complex financial instruments.

### 7. Final Completion Criteria
- User approval and architectural specification before commencing any Phase B12 implementation.

---

## ROADMAP EXECUTION & DEPENDENCY GRAPH

```
[Phase B1: Booking Audit] (COMPLETED ✅)
       │
       ▼
[Phase B1 Fixes] ──► [Phase B3: Security & RBAC] ──► [Phase B2: Comms & WebSockets]
                                │                                │
       ┌────────────────────────┴────────────────────────────────┴────────┐
       ▼                                                                  ▼
[Phase B4: Farmer Portal] ──► [Phase B5: Provider Portal] ──► [Phase B6: Admin Portal]
       │                                                                  │
       ├────────────────────────┬─────────────────────────────────────────┤
       ▼                        ▼                                         ▼
[Phase B7: IoT Alerts]   [Phase B8: Multilingual]            [Oct 1 Renewal Window]
       │                        │                                         │
       └────────────────────────┼─────────────────────────────────────────┘
                                ▼
                 [Phase B9: AI Deep Audit (Post Oct 1)]
                                │
                                ▼
                 [Phase B10: Render Workload Architecture]
                                │
                                ▼
                 [Phase B11: Load & Resilience Hardening]
                                │
                                ▼
                 [Phase B12: Advanced Upgrades & Features]
```

---

## SUMMARY OF CURRENT STATUS ACROSS ALL PHASES

| Phase | Title | Current Status | Primary Focus |
| :--- | :--- | :--- | :--- |
| **B1** | Booking Ecosystem | **AUDITED (Awaiting Fix Approval)** | Fix RBAC, Slot Engine, Concurrency, Deploy Main |
| **B2** | Comms / Notifications / Realtime | **NOT STARTED** | Fix WebSocket events, Provider WS, Chat auth |
| **B3** | Security + Data Isolation | **NOT STARTED** | Enforce JWT, Tenant isolation, Pydantic models |
| **B4** | Farmer Portal End-to-End | **NOT STARTED** | Verify field scan, area calc, passbook voucher E2E |
| **B5** | Provider Portal End-to-End | **NOT STARTED** | Tenant order filtering, date-specific availability |
| **B6** | Admin Portal End-to-End | **NOT STARTED** | Add booking management, ticket linking |
| **B7** | IoT + Alerts | **NOT STARTED** | ESP32 batch telemetry, threshold alerts |
| **B8** | Full Multilingual Verification | **NOT STARTED** | 13-language parity, protect technical identifiers |
| **B9** | AI Deep Audit + Accuracy | **SCHEDULED (Post-Oct 1)** | Model accuracy, Grad-CAM++, NVIDIA NIM prompts |
| **B10**| Distributed Render Architecture | **NOT STARTED** | Workload separation, route alignment across 4 nodes |
| **B11**| Performance / Load / Failure | **NOT STARTED** | Stress testing, ephemeral disk recovery, pagination |
| **B12**| New Features + Advanced Upgrades | **PLANNED (Future)** | Visual calendar, GPS routing, digital escrow |

---
**END OF MASTER ROADMAP (B1_TO_B12_MASTER_ROADMAP.md)**
