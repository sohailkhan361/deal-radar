# Deal Radar — Project Summary

> Real-time B2B sales pipeline intelligence. Ingests CRM events, enforces MEDDICC data hygiene, scores deal health with OpenAI, and streams live updates to a monitoring dashboard.

---

## Table of Contents

1. [What It Does](#1-what-it-does)
2. [Use Cases](#2-use-cases)
3. [Architecture](#3-architecture)
4. [Technology Choices & Rationale](#4-technology-choices--rationale)
5. [Tradeoffs & Known Limitations](#5-tradeoffs--known-limitations)
6. [Data Model](#6-data-model)
7. [API Reference](#7-api-reference)
8. [Tutorial — End-to-End Walkthrough](#8-tutorial--end-to-end-walkthrough)
9. [Running Locally](#9-running-locally)
10. [Environment Variables](#10-environment-variables)
11. [Production Hardening Checklist](#11-production-hardening-checklist)

---

## 1. What It Does

Deal Radar watches a B2B sales pipeline in near real-time.

A CRM or mock generator POSTs deal events (stage changes, emails, meetings, notes, closures) to a webhook. The system processes them asynchronously through a Redis-backed queue, persists deal state and activity history to Postgres, scores each deal using an AI engine built on MEDDICC methodology, and pushes scored results to connected dashboards over Server-Sent Events.

Sales managers see a live panel showing every deal's health score (0–100), risk level (LOW / MEDIUM / HIGH), AI reasoning, and concrete next-step recommendations — or, when a deal has data quality problems, exactly which fields are missing and what the rep must do to fix them.

---

## 2. Use Cases

### Sales Operations Manager
Monitors the full pipeline at a glance. The Pipeline Pulse header shows average health, total revenue watched, hygiene failure count, and high-risk deal count — all live. Deals blocked from scoring show a "Cannot Score" card with every missing MEDDICC field highlighted as an actionable chip.

### Sales Representative
Opens a deal card to see AI reasoning grounded in MEDDICC: why the deal scored 42, which dimension is weakest, and a single concrete next step ("Schedule Economic Buyer introduction before next QBR"). Non-blocking warnings are shown below so the rep understands quality gaps even when the deal is scoreable.

### CRM Integration / Ops Engineer
POSTs webhook events in camelCase or snake_case — the system accepts both. Duplicate events are silently deduplicated via the idempotency ledger. The Bull Board admin UI at `/admin/queues` shows live queue depth, failed jobs with stack traces, retry counts, and Redis health — no extra tooling needed.

### Data Engineering / Platform Team
The event pipeline is decoupled end-to-end. The webhook returns `202 Accepted` immediately; processing happens asynchronously in BullMQ. Failed jobs are retried up to 3 times with exponential backoff and the last 500 failures are preserved for inspection. `DeadLetterEvent` is reserved for deeper failure capture.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         External Systems                        │
│          CRM / Mock Generator → POST /api/webhook               │
└──────────────────────────────┬──────────────────────────────────┘
                               │ 202 Accepted
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend  (Express :4000)                    │
│                                                                 │
│  WebhookController → Zod validation → BullMQ queue             │
│                                  │                              │
│                                  ▼                              │
│            Redis (BullMQ)  ←──  job enqueued                    │
│                                  │                              │
│            BullMQ Worker  ←──────┘                              │
│              │                                                  │
│              ├─ Idempotency check (ProcessedEvent table)        │
│              ├─ Deal upsert + applyEvent (stage/amount/date)    │
│              ├─ Activity log                                    │
│              ├─ scoreAndPersist()                               │
│              │    ├─ checkHygiene() → BLOCKING/WARNING gates    │
│              │    └─ scoreDeal()   → OpenAI gpt-4o-mini         │
│              └─ SSE broadcast → deal-event-processed            │
│                                                                 │
│  GET /api/deals  ←─  DealController → DealService → Prisma     │
│  GET /health     ←─  HealthController (DB ping)                 │
│  /admin/queues   ←─  Bull Board UI                              │
└────────────────────────────┬────────────────────────────────────┘
                             │ Server-Sent Events
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend  (Next.js :3000)                    │
│                                                                 │
│  EventSource → sseClient → Zustand store                        │
│    └─ invalidates TanStack Query → re-fetches /api/deals        │
│                                                                 │
│  ActivityStream  — live event feed (pause/resume/filter)        │
│  DealPanel       — health scores, risk, AI reasoning, hygiene   │
│  Filters         — header bar (search + filter chips)           │
└─────────────────────────────────────────────────────────────────┘
```

### Event Lifecycle

```
CRM → POST /webhook
         │
         ├─ Zod validates (camelCase + snake_case both accepted)
         ├─ jobId = eventId  (deduplication key)
         ├─ BullMQ.add()
         └─ 202 Accepted

BullMQ Worker (concurrency: 1)
         │
         ├─ hasProcessedEvent()? → skip (idempotent)
         │
         ├─ Postgres $transaction
         │    ├─ ensureDeal (upsert on first event)
         │    ├─ saveActivity
         │    ├─ applyEvent  (stage/amount/close date)
         │    ├─ storeProcessedEvent
         │    └─ scoreAndPersist
         │         ├─ checkHygiene (BLOCKING → HYGIENE_FAIL)
         │         └─ scoreDeal    (OpenAI → SCORED/HYGIENE_WARN)
         │
         └─ broadcastProcessedEvent (SSE)

Frontend
         ├─ SSE: deal-event-processed
         ├─ 1.2 s debounce
         └─ TanStack Query invalidate → GET /api/deals
```

---

## 4. Technology Choices & Rationale

### Node.js + TypeScript
End-to-end TypeScript across backend, frontend, and all packages eliminates an entire class of integration bugs. The shared-types package means the API response shape, hygiene action types, and SSE payloads are all defined once and referenced everywhere — the compiler catches drift before it hits production.

### Express (backend)
Minimal, predictable, well-understood. The routing surface is small and explicit. Helmet + CORS + Morgan are drop-in for production-grade security and logging without framework magic. Express 4's middleware model makes the CSP carve-out for Bull Board straightforward (`app.use('/admin', helmet({ contentSecurityPolicy: false }))`).

### BullMQ + Redis
BullMQ provides:
- **Reliable delivery** — jobs survive process restarts
- **At-least-once processing** with idempotency via the `ProcessedEvent` table
- **Exponential backoff retries** (3 attempts, 5 s initial delay)
- **Observability** — Bull Board surfaces the full queue state, job payloads, error stacks, and retry history without any custom code
- **Decoupling** — the webhook returns 202 immediately; scoring never blocks the HTTP response

Redis as a queue backing store is operationally simpler than Kafka for this scale and does not require a separate consumer group management layer.

### Prisma + PostgreSQL
Prisma provides compile-time query safety — the mapper functions in `deal-mapper.ts` map Prisma's typed rows directly to the API response types in shared-types. The `hygieneActions Json?` column stores the full serialised `HygieneAction[]` without a separate table; this is appropriate for data that is always read and written as a unit and never queried independently.

### OpenAI (gpt-4o-mini)
The scoring engine sends a structured MEDDICC-annotated prompt at temperature 0.2. The low temperature keeps outputs deterministic enough for consistent score comparisons across runs. gpt-4o-mini was chosen for cost efficiency at POC scale; the model is configurable via `OPENAI_MODEL` env var.

### Next.js 15 + TanStack Query + Zustand
- **Next.js** gives SSR, file-based routing, and Tailwind integration out of the box.
- **TanStack Query** handles loading/error/empty states, background revalidation, retry logic, and cache management without manual useState juggling.
- **Zustand** keeps the SSE event store simple and synchronous — no context providers, no re-render cascades.
- These two stores are intentionally decoupled: Zustand owns the real-time stream; TanStack Query owns the REST data. The `useDeals` hook bridges them — it watches the Zustand store and invalidates the query 1.2 s after any `deal-event-processed` event arrives.

### MEDDICC Methodology
MEDDICC (Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion, Competition) is the industry-standard B2B qualification framework. Encoding it as structured hygiene checks rather than free-form AI prompts means:
- Failures are deterministic and explainable
- Each missing field maps to a specific, actionable remediation step
- Stage-awareness prevents over-gating early-stage deals (only core fields required for Discovery)

---

## 5. Tradeoffs & Known Limitations

### Single Worker Concurrency
`concurrency: 1` on the BullMQ worker serialises all deal processing. This prevents race conditions on deal upserts and ensures scoring sees the full activity history. The tradeoff is throughput: at high event volume, the queue will back up. To scale, shard workers by `dealId` hash using BullMQ's `group` feature.

### Scoring is Synchronous Inside the Transaction
`scoreAndPersist` runs inside the Prisma transaction so the scored deal is written atomically with the activity. This means the transaction holds open while OpenAI responds (typically 1–3 s). For very high-throughput pipelines, extract scoring to a separate post-transaction step.

### No Authentication
The webhook, API, and Bull Board admin are unauthenticated. For production: add API key middleware to the webhook, JWT to the REST API, and Basic Auth or SSO to `/admin/queues`.

### Hardcoded Deal Labels in the Frontend
`format-stream-event.ts` contains a static map of dealId → display name. Unknown deals fall back to the raw dealId. For production, fetch deal metadata from the API.

### hygieneActions Stored as JSON
The `hygieneActions` column is a JSON blob rather than a normalised table. This is fine for read-heavy display patterns but cannot be queried efficiently (e.g. "all deals missing a champion"). Add a materialised view or separate table if analytical queries are needed.

### DeadLetterEvent Table
The schema includes `DeadLetterEvent` but the worker does not write to it. It's reserved for a follow-up where any job that exhausts all retries is archived there for manual inspection rather than disappearing into BullMQ's failed set.

---

## 6. Data Model

```
Deal
├── id              UUID (PK)
├── dealId          String (unique, CRM identifier)
├── stage           String
├── amount          Decimal
├── closeDate       DateTime
├── healthScore     Float?          (0.0 – 1.0, null when unscored)
├── riskLevel       String?         (LOW | MEDIUM | HIGH)
├── validationStatus String         (PENDING | SCORED | HYGIENE_FAIL)
├── aiReasoning     String?
├── recommendedAction String?
├── hygieneStatus   String          (UNCHECKED | PASS | WARN | FAIL)
├── missingFields   String[]        (blocking field paths)
├── hygieneActions  Json?           (HygieneAction[] — blocking + warnings)
├── lastHygieneAt   DateTime?
├── meddiccMetrics          String?
├── meddiccEconomicBuyer    String?
├── meddiccDecisionCriteria String?
├── meddiccDecisionProcess  String?
├── meddiccIdentifyPain     String?
├── meddiccChampion         String?
├── meddiccCompetition      String?
└── activities      Activity[]

Activity
├── id          UUID
├── eventId     String (unique — idempotency)
├── dealId      String (FK → Deal.dealId)
├── eventType   String
├── payload     Json
└── occurredAt  DateTime

ProcessedEvent
└── eventId     String (PK) — written atomically with Activity to gate duplicates

DeadLetterEvent
├── id          UUID
├── rawPayload  Json
├── reason      String
└── failedAt    DateTime
```

---

## 7. API Reference

### `GET /health`
Returns server + database status.

```json
{
  "status": "ok",
  "timestamp": "2026-06-06T12:00:00.000Z",
  "services": { "database": "ok" }
}
```
Returns `503` with `"status": "degraded"` if Postgres is unreachable.

---

### `GET /api/deals`

Paginated deal list with state, health, hygiene, and recent activities.

| Param | Default | Max | Description |
|---|---|---|---|
| `page` | 1 | — | Page number (1-based) |
| `limit` | 20 | 100 | Deals per page |
| `activityLimit` | 10 | 50 | Recent activities per deal |

Response shape:
```json
{
  "data": [{
    "id": "uuid",
    "dealId": "deal-acme-001",
    "state": { "stage": "PROPOSAL", "amount": "120000", "closeDate": "2026-09-01T..." },
    "health": {
      "healthScore": 0.74,
      "riskLevel": "MEDIUM",
      "validationStatus": "SCORED",
      "aiReasoning": "...",
      "recommendedAction": "...",
      "hygiene": {
        "cannotScore": false,
        "hygieneStatus": "PASS",
        "missingFields": [],
        "hygieneActions": [],
        "lastHygieneAt": "2026-06-06T..."
      }
    },
    "activities": [...],
    "activityCount": 12
  }],
  "pagination": { "page": 1, "limit": 20, "total": 4, "totalPages": 1, "hasMore": false }
}
```

---

### `GET /api/deals/:dealId`

Single deal with full MEDDICC fields and paginated activities.

Same `page` / `limit` params apply to activities.

Returns `404` if the deal doesn't exist.

---

### `POST /api/webhook`

Ingest a deal event. Accepts both camelCase and snake_case field names.

```json
{
  "event_id": "evt-001",
  "deal_id": "deal-acme-001",
  "event_type": "stage_changed",
  "occurred_at": "2026-06-06T12:00:00.000Z",
  "payload": {
    "stage": "PROPOSAL",
    "amount": 120000,
    "close_date": "2026-09-01T00:00:00.000Z"
  }
}
```

Returns `202 { "accepted": true }`. Duplicate `eventId`s are silently ignored.

Supported event types: `stage_changed`, `email_sent`, `meeting_booked`, `note_added`, `deal_closed`.

---

### `GET /api/events/stream`

SSE endpoint. Connect with `EventSource` or curl:

```bash
curl -N http://localhost:4000/api/events/stream
```

Events emitted:

| Event | Payload |
|---|---|
| `connected` | `{ clientId, activeClients }` |
| `heartbeat` | `{ timestamp }` — every 30 s |
| `deal-event-processed` | `{ eventId, dealId, eventType, processedAt }` |

---

### `GET /admin/queues`

Bull Board UI. Shows:
- Active, waiting, delayed, paused, completed, failed job counts
- Per-job payload, stack trace, retry history
- Queue pause/resume, manual retry, clean actions
- Redis memory and connection stats

---

## 8. Tutorial — End-to-End Walkthrough

This walkthrough takes you from zero to a live scored deal on the dashboard.

### Step 1 — Start infrastructure

```bash
docker compose up -d postgres redis
```

### Step 2 — Prepare the database

```bash
npm run prisma:migrate -w @deal-radar/backend
```

### Step 3 — Start the backend

```bash
npm run dev -w @deal-radar/backend
```

You should see:
```
[server] Listening on port 4000 (development)
[server] Health → http://localhost:4000/health
[server] Bull Board → http://localhost:4000/admin/queues
[queue] Redis configured at localhost:6379
[queue:deal-events] Queue registered
[worker:deal-events] Worker ready
```

Verify:
```bash
curl http://localhost:4000/health
# {"status":"ok","timestamp":"...","services":{"database":"ok"}}
```

### Step 4 — Start the frontend

```bash
npm run dev -w @deal-radar/frontend
```

Open **http://localhost:3000** — you'll see the dashboard with three skeleton cards loading, then an empty state.

### Step 5 — Send your first event

```bash
curl -X POST http://localhost:4000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt-001",
    "deal_id": "deal-acme-001",
    "event_type": "stage_changed",
    "occurred_at": "2026-06-06T12:00:00.000Z",
    "payload": {
      "stage": "PROPOSAL",
      "amount": 120000,
      "close_date": "2027-03-01T00:00:00.000Z"
    }
  }'
```

**What happens:**
1. Webhook validates and enqueues the job (`jobId = evt-001`)
2. Worker picks it up, upserts the deal, saves the activity
3. `scoreAndPersist` runs hygiene checks — this deal has no MEDDICC fields, so it returns `HYGIENE_FAIL`
4. Deal is written to Postgres with `validationStatus: HYGIENE_FAIL`
5. SSE broadcasts `deal-event-processed` to connected browsers
6. Frontend receives the event, waits 1.2 s, re-fetches `/api/deals`
7. The deal card appears with a "Cannot Score" warning and missing field chips

You'll see in the backend logs:
```
[webhook] Deal event enqueued { jobId: 'evt-001', ... }
[worker:deal-events] Event processed { eventId: 'evt-001', ... }
[scoring] Deal cannot be scored — hygiene issues found { blocking: 6, ... }
```

### Step 6 — Fill in MEDDICC fields and close date

Send another event that populates the pain, metrics, and champion fields:

```bash
curl -X POST http://localhost:4000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt-002",
    "deal_id": "deal-acme-001",
    "event_type": "note_added",
    "occurred_at": "2026-06-06T12:05:00.000Z",
    "payload": {
      "note": "Champion confirmed: VP Engineering Sarah Chen. Pain: manual reporting costs 40h/week. Metrics: $200k annual saving. Champion committed to presenting to CFO next week."
    }
  }'
```

This adds activity history but doesn't update MEDDICC fields directly (those come from the CRM's deal record, not event payloads in this data model). To see a scored deal, update the MEDDICC columns directly in Postgres:

```sql
UPDATE "Deal"
SET
  "meddiccIdentifyPain"     = 'Manual reporting costs 40h/week across 3 teams',
  "meddiccMetrics"          = '$200k annual saving, 40h/week reclaimed',
  "meddiccChampion"         = 'Sarah Chen, VP Engineering',
  "meddiccEconomicBuyer"    = 'James Park, CFO',
  "meddiccDecisionCriteria" = 'Security compliance, Salesforce integration, ROI < 12 months',
  "meddiccDecisionProcess"  = 'Sarah → CFO approval → Legal → PO by Q3'
WHERE "dealId" = 'deal-acme-001';
```

Then send another event to trigger rescoring:

```bash
curl -X POST http://localhost:4000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt-003",
    "deal_id": "deal-acme-001",
    "event_type": "meeting_booked",
    "occurred_at": "2026-06-06T12:10:00.000Z",
    "payload": { "subject": "Economic Buyer intro call" }
  }'
```

**What happens:** Hygiene checks pass (all MEDDICC fields present, activity recent, amount > 0, close date in future). OpenAI scores the deal. The frontend updates within ~3 s — the deal card shows the score ring, risk badge, AI reasoning, and recommended action.

### Step 7 — Watch the activity stream

Open the Activity Stream panel on the left. Each event card shows:
- Event type badge (colour-coded)
- Deal name
- Timestamp (relative)
- Event status (clean / warning / conflict)

Use the filter chips to narrow by event type. Pause and resume the stream with the Pause button. The auto-scroll toggle keeps the latest events at the top.

### Step 8 — Inspect the queue

Open **http://localhost:4000/admin/queues**.

You'll see the `deal-events` queue with:
- **Completed** tab — all processed jobs with payloads and timing
- **Failed** tab — any jobs that failed all retries, with full stack traces
- Per-job detail — input data, attempt count, processing time

To test retry: send a webhook event while the backend has no database connection. The job will fail and appear in the Failed tab. Restart the backend to let it reconnect, then click Retry on the failed job.

### Step 9 — Simulate the mock generator

```bash
npm run mock
```

This sends a random event to the webhook every 2 s, cycling through all deal IDs and event types. Watch the Activity Stream fill up in real time and the DealPanel scores update.

---

## 9. Running Locally

### Prerequisites

- Node.js 20+
- Docker (for Postgres and Redis)
- npm workspaces

### Quick start

```bash
# 1. Install all dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL, REDIS_HOST=localhost, OPENAI_API_KEY

# 3. Start infrastructure
docker compose up -d postgres redis

# 4. Migrate database
npm run prisma:generate -w @deal-radar/backend
npm run prisma:migrate -w @deal-radar/backend

# 5. Start backend
npm run dev -w @deal-radar/backend

# 6. Start frontend (new terminal)
npm run dev -w @deal-radar/frontend

# 7. Send mock events (new terminal)
npm run mock
```

| URL | Purpose |
|---|---|
| http://localhost:3000 | Dashboard |
| http://localhost:4000/health | Backend health |
| http://localhost:4000/admin/queues | Bull Board |
| http://localhost:4000/api/events/stream | SSE stream (curl) |

---

## 10. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development` \| `production` \| `test` |
| `PORT` | No | `4000` | Backend HTTP port |
| `DATABASE_URL` | **Yes** | — | Postgres connection string |
| `REDIS_HOST` | No | `localhost` | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |
| `OPENAI_API_KEY` | Recommended | — | OpenAI key — deals HYGIENE_FAIL without it |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Override the scoring model |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:4000` | Backend URL for the frontend |
| `CHOKIDAR_USEPOLLING` | No | — | Set `true` for Docker file watching |

For local development (backend running on host, not in Docker):
```env
DATABASE_URL=postgresql://deal_radar:deal_radar_password@localhost:5432/deal_radar?schema=public
REDIS_HOST=localhost
```

---

## 11. Production Hardening Checklist

### Completed in this pass

| Area | Change |
|---|---|
| Type safety | `errorHandler` uses `unknown` instead of `any`; `AppError` class for structured HTTP errors |
| Type safety | `DealEventType` is authoritative in `shared-types` — removed duplicate in `bull.queue.ts` |
| Type safety | Orphaned `Deal` interface removed from `shared-types/index.ts` |
| Type safety | Dead `useAppStore` with `deals: any[]` removed from `store/index.ts` |
| Type safety | Unused `EARLY_STAGES` constant removed from `hygiene.ts` |
| Error handling | `errorHandler` catches `unknown`, no `err.stack` leak in production |
| Error handling | SSE `send()` catches broken pipe errors — removes client silently instead of crashing |
| Error handling | `api.ts` surfaces HTTP status + body in error messages; adds 15 s request timeout |
| Env validation | `DATABASE_URL` is now required (fails fast on startup); `OPENAI_API_KEY` documented |
| Health check | `/health` pings Postgres and returns `503` when degraded |
| Graceful shutdown | `SIGTERM`/`SIGINT` handlers close HTTP server → BullMQ worker → Prisma cleanly |
| Worker | `closeDealEventsWorker()` exported and called on shutdown |
| Retry config | `QueryProvider` configures retry (skip 4xx), `retryDelay`, `staleTime`, `gcTime`, `refetchOnWindowFocus: false` |
| Loading states | Skeleton cards while deals load; spinner on background refetch |
| Error states | Error card with retry button in DealPanel |
| Empty states | Empty state card when no deals exist |
| Architecture | SSE `event-stream.ts` no longer imports from `DealEventJobData` — uses canonical `DealEventType` from shared-types |

### Recommended next steps

| Area | Action |
|---|---|
| Authentication | Add API key middleware to webhook; JWT to REST API; Basic Auth to `/admin/queues` |
| Rate limiting | Add `express-rate-limit` to the webhook endpoint |
| Request ID | Add `x-request-id` header and thread it through logs |
| Structured logging | Replace `console.*` with `pino` for JSON log output |
| Metrics | Expose Prometheus metrics (queue depth, scoring latency, error rates) |
| Dead letter | Wire exhausted BullMQ jobs to write `DeadLetterEvent` rows |
| MEDDICC updates | Expose a `PATCH /api/deals/:dealId/meddicc` endpoint so reps can update fields without a full CRM event |
| Deal search | Connect the Filters search input to a debounced `GET /api/deals?search=` query |
| Pagination | Add "load more" to DealPanel for pipelines with >20 deals |
| Test suite | Add unit tests for `hygiene.ts` (all check branches), `deal-mapper.ts`, and `webhook.controller.ts` |
