<img width="1352" height="804" alt="Deal Radar Dashboard" src="https://github.com/user-attachments/assets/b12f4596-8245-40b3-bd1d-ec0dcff52abe" />

# Deal Radar

**Real-time AI co-pilot for B2B sales pipelines.**

Deal Radar ingests CRM events, enforces MEDDICC data quality, scores every deal with OpenAI, and streams live health intelligence to a monitoring dashboard — all in near real-time.

Built as an npm monorepo: Express backend · Next.js frontend · BullMQ job queue · Prisma + PostgreSQL · Redis · OpenAI GPT-4o-mini.

---

## Screenshots

<img width="1352" height="803" alt="Deal Panel — scored deal" src="https://github.com/user-attachments/assets/971db0bd-41e5-495b-b32b-f0e87f529622" />
<img width="1352" height="805" alt="Deal Panel — hygiene failure" src="https://github.com/user-attachments/assets/c5b4c493-ea2b-4bae-a579-ee6b805fc4cf" />
<img width="1352" height="806" alt="Activity Stream" src="https://github.com/user-attachments/assets/5ba5ec5b-a306-4b91-b315-5976e4fe53d2" />
<img width="1352" height="803" alt="Bull Board queue monitor" src="https://github.com/user-attachments/assets/c63a6e72-a231-4c8f-aa4c-c939474467ba" />

---

## Table of contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Quick start — run on any machine](#quick-start--run-on-any-machine)
- [Environment variables](#environment-variables)
- [Running the application](#running-the-application)
- [Mock event generator](#mock-event-generator)
- [API reference](#api-reference)
- [Queue monitor — Bull Board](#queue-monitor--bull-board)
- [AI scoring & hygiene engine](#ai-scoring--hygiene-engine)
- [Database](#database)
- [Available scripts](#available-scripts)
- [Troubleshooting](#troubleshooting)

---

## What it does

1. **Ingest** — CRM systems POST deal events (stage changes, emails, meetings, notes, closures) to a webhook endpoint. Both camelCase and snake_case field names are accepted.
2. **Queue** — Events are enqueued in Redis via BullMQ for reliable, async processing with exponential-backoff retries.
3. **Process** — A background worker deduplicates events, upserts deal state, saves a full activity history, then triggers AI scoring.
4. **Score** — The AI engine runs MEDDICC hygiene checks first. If data is missing or conflicting, the deal is marked `HYGIENE_FAIL` with specific actionable guidance. If data quality passes, OpenAI GPT-4o-mini scores the deal (0–100) with a risk level, reasoning, and recommended next step.
5. **Broadcast** — Processed events are pushed to all connected browsers via Server-Sent Events.
6. **Display** — The dashboard shows a live activity feed and a Deal Panel with health scores, risk badges, AI reasoning, and hygiene warnings per deal — updating automatically as events arrive.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        External / Mock CRM                       │
│                    POST /api/webhook  (events)                   │
└──────────────────────────┬───────────────────────────────────────┘
                           │ 202 Accepted immediately
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Backend  (Express :4000)                       │
│                                                                  │
│  WebhookController  →  Zod validation  →  BullMQ.add()          │
│                                   │                              │
│                           Redis queue                            │
│                                   │                              │
│                        BullMQ Worker (concurrency 1)             │
│                          ├─ Idempotency check                    │
│                          ├─ Deal upsert + applyEvent             │
│                          ├─ Activity log                         │
│                          ├─ scoreAndPersist()                    │
│                          │    ├─ checkHygiene()  MEDDICC gates   │
│                          │    └─ scoreDeal()     OpenAI          │
│                          └─ SSE broadcast                        │
│                                                                  │
│  GET /api/deals          →  DealController  →  Prisma            │
│  GET /health             →  DB ping                              │
│  GET /admin/queues       →  Bull Board UI                        │
└─────────────────────────┬────────────────────────────────────────┘
                          │  Server-Sent Events
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Frontend  (Next.js :3000)                       │
│                                                                  │
│  EventSource → sseClient → Zustand store                        │
│    └─ invalidates TanStack Query → re-fetches /api/deals         │
│                                                                  │
│  ActivityStream   live event feed (pause / resume / filter)      │
│  DealPanel        health score ring, risk badge, AI reasoning,   │
│                   hygiene warning cards with actionable steps     │
│  Filters          header search + filter chips                   │
└──────────────────────────────────────────────────────────────────┘
```

### Event lifecycle

```
CRM  →  POST /api/webhook
              │
              ├─ Zod validates (camelCase + snake_case)
              ├─ BullMQ.add(jobId = eventId)  ← deduplication key
              └─ 202 Accepted

BullMQ Worker
              ├─ hasProcessedEvent()?  →  skip (idempotent)
              │
              └─ Postgres $transaction
                   ├─ ensureDeal   (upsert on first event)
                   ├─ saveActivity
                   ├─ applyEvent   (stage / amount / close date)
                   ├─ storeProcessedEvent
                   └─ scoreAndPersist
                        ├─ checkHygiene()
                        │    BLOCKING  →  HYGIENE_FAIL, persist actions
                        │    WARNING   →  score anyway, persist warnings
                        │    PASS      →  proceed to OpenAI
                        └─ scoreDeal()  →  OpenAI  →  SCORED

              └─ broadcastProcessedEvent (SSE → all browsers)

Frontend
              ├─ SSE: deal-event-processed received
              ├─ 1.2 s debounce
              └─ TanStack Query invalidate → GET /api/deals → re-render
```

---

## Repository structure

```
deal-radar/
├── apps/
│   ├── backend/                    Express API server
│   │   ├── src/
│   │   │   ├── config/env.ts       Zod-validated env schema
│   │   │   ├── controllers/        deal, health, webhook
│   │   │   ├── lib/                deal-mapper, pagination
│   │   │   ├── middlewares/        error handler + AppError class
│   │   │   ├── queues/             BullMQ queue, worker, queue service
│   │   │   ├── routes/             Express routers
│   │   │   ├── services/           deal, activity, scoring, prisma
│   │   │   └── sse/                SSE client manager
│   │   └── prisma/
│   │       ├── schema.prisma       Deal, Activity, ProcessedEvent, DeadLetterEvent
│   │       └── migrations/
│   └── frontend/                   Next.js 15 dashboard
│       └── src/
│           ├── app/                page.tsx, layout.tsx, globals.css
│           ├── components/dashboard/
│           │   ├── ActivityStream.tsx   live event feed
│           │   ├── DealPanel.tsx        AI health + hygiene UI
│           │   ├── EventCard.tsx        individual event card
│           │   └── Filters.tsx          search header
│           ├── hooks/              useDeals, useEventStream
│           ├── lib/                api client, SSE client, formatters
│           ├── providers/          TanStack Query provider
│           └── store/              Zustand event stream store
├── packages/
│   ├── shared-types/               TypeScript types shared across all apps
│   ├── ai-engine/                  MEDDICC hygiene engine + OpenAI scoring
│   └── validation-engine/          Zod schemas (reserved)
├── scripts/
│   └── mock-generator.ts           CRM event simulator
├── docker-compose.yml              Postgres + Redis + optional backend
├── .env.example                    Environment variable template
└── package.json                    npm workspaces root
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | 20 or higher | Check: `node -v` |
| **npm** | 9 or higher | Comes with Node; check: `npm -v` |
| **Docker Desktop** | Any recent | For Postgres + Redis |
| **OpenAI API key** | — | Required for AI scoring; get one at platform.openai.com |

You do **not** need to install Postgres or Redis manually — Docker handles both.

---

## Quick start — run on any machine

These steps work on macOS, Linux, and Windows (WSL2). Follow them in order.

### Step 1 — Clone the repo

```bash
git clone <repo-url>
cd deal-radar
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the two required values:

```env
# Use localhost for everything when running backend on your machine
DATABASE_URL=postgresql://deal_radar:deal_radar_password@localhost:5432/deal_radar?schema=public
REDIS_HOST=localhost

# Your OpenAI key — required for AI scoring
OPENAI_API_KEY=sk-...
```

The other variables already have working defaults. Leave them unless you need to change ports.

### Step 4 — Start infrastructure (Postgres + Redis)

```bash
docker compose up -d postgres redis
```

Wait ~5 seconds for both containers to become healthy:

```bash
docker compose ps
# both should show "(healthy)"
```

### Step 5 — Set up the database

```bash
npm run prisma:generate -w @deal-radar/backend
npm run prisma:migrate -w @deal-radar/backend
```

You should see: `Your database is now in sync with your schema.`

### Step 6 — Start the backend

Open a new terminal tab:

```bash
npm run dev -w @deal-radar/backend
```

You should see:
```
[server] Listening on port 4000 (development)
[server] Health    → http://localhost:4000/health
[server] Bull Board → http://localhost:4000/admin/queues
[worker:deal-events] Worker ready
```

Verify it's up:
```bash
curl http://localhost:4000/health
# {"status":"ok","timestamp":"...","services":{"database":"ok"}}
```

### Step 7 — Start the frontend

Open another terminal tab:

```bash
npm run dev -w @deal-radar/frontend
```

Open **http://localhost:3000** in your browser. You'll see the Deal Radar dashboard.

### Step 8 — Send mock events

Open a third terminal tab:

```bash
npm run mock
```

Events start flowing every 2 seconds. The Activity Stream fills up live, and deals appear in the Deal Panel. Deals will show hygiene warnings until MEDDICC fields are populated (this is by design — see the tutorial section).

---

That's it. Four terminals, everything live.

| Service | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Health check | http://localhost:4000/health |
| Queue monitor | http://localhost:4000/admin/queues |
| SSE stream | http://localhost:4000/api/events/stream |
| Webhook | POST http://localhost:4000/api/webhook |

---

## Environment variables

### `apps/backend/.env` (backend only)

The backend reads its own `.env` file at startup via `dotenv/config`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | Full Postgres connection string |
| `REDIS_HOST` | No | `localhost` | Redis hostname |
| `REDIS_PORT` | No | `6379` | Redis port |
| `PORT` | No | `4000` | HTTP server port |
| `NODE_ENV` | No | `development` | `development` · `production` · `test` |
| `OPENAI_API_KEY` | Recommended | — | Needed for AI scoring; deals stuck at `HYGIENE_FAIL` without it |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Override the scoring model |

### `.env` (root — read by the frontend and mock generator)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:4000` | Backend base URL for the browser |
| `MOCK_WEBHOOK_URL` | No | `http://localhost:4000/api/webhook` | Override mock generator target |
| `MOCK_INTERVAL_MS` | No | `2000` | Milliseconds between mock events |

### When running backend inside Docker Compose

When `backend` runs as a Docker service, it must use the Docker service name for internal networking:

```env
DATABASE_URL=postgresql://deal_radar:deal_radar_password@postgres:5432/deal_radar?schema=public
REDIS_HOST=redis
```

---

## Running the application

### Recommended — hybrid (infra in Docker, apps on host)

Best for development. Hot reload works, logs are easy to read.

```
Terminal 1:  docker compose up -d postgres redis
Terminal 2:  npm run dev -w @deal-radar/backend
Terminal 3:  npm run dev -w @deal-radar/frontend
Terminal 4:  npm run mock
```

### All in Docker Compose

Backend, Postgres, and Redis all in containers. Frontend still runs locally (no Docker image defined for it).

```bash
# Start everything in Docker
docker compose up -d postgres redis backend

# Start frontend locally
npm run dev -w @deal-radar/frontend

# Send mock events
npm run mock
```

> The Docker backend image runs `npm install` and `prisma generate` automatically on startup. It does **not** run migrations — run those from your host first: `npm run prisma:migrate -w @deal-radar/backend`

### Production build

```bash
npm run build                             # build all workspaces
npm run start -w @deal-radar/backend      # start compiled backend
npm run start -w @deal-radar/frontend     # start Next.js production server
```

---

## Mock event generator

Simulates a CRM sending deal events. Runs from the repository root.

```bash
npm run mock
```

### Options

```bash
# Send exactly 10 events then stop
npm run mock -- --count=10

# Preview payloads without hitting the API
npm run mock -- --dry-run

# Custom interval (5 seconds between events)
MOCK_INTERVAL_MS=5000 npm run mock

# Point at a different backend
MOCK_WEBHOOK_URL=http://my-server:4000/api/webhook npm run mock
```

### Scenarios generated

| Scenario | Description |
|---|---|
| `normal_event` | Random event for a known deal |
| `duplicate_event` | Replays the previous event — tests idempotency |
| `missing_activity_history` | Event for a brand-new deal with no history |
| `source_of_truth_conflict` | Conflicting stage/amount data |
| `out_of_order_event` | Event with an older `occurred_at` timestamp |

### Supported event types

| Type | Effect |
|---|---|
| `stage_changed` | Updates deal stage, amount, close date |
| `email_sent` | Logged as activity only |
| `meeting_booked` | Logged as activity only |
| `note_added` | Logged as activity only |
| `deal_closed` | Sets stage to `CLOSED` (manual webhook only) |

### Manual webhook test

```bash
curl -X POST http://localhost:4000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt-demo-001",
    "deal_id": "deal-acme-001",
    "event_type": "stage_changed",
    "occurred_at": "2026-06-07T10:00:00.000Z",
    "payload": {
      "stage": "PROPOSAL",
      "amount": 120000,
      "close_date": "2027-03-01T00:00:00.000Z"
    }
  }'
# → 202 {"accepted":true}
```

Both **snake_case** (`event_id`, `deal_id`) and **camelCase** (`eventId`, `dealId`) field names are accepted.

---

## API reference

### `GET /health`

Returns server and database connectivity status.

```json
{
  "status": "ok",
  "timestamp": "2026-06-07T10:00:00.000Z",
  "services": { "database": "ok" }
}
```

Returns `503` with `"status": "degraded"` if Postgres is unreachable.

---

### `GET /api/deals`

Paginated list of deals with state, AI health, hygiene info, and recent activities.

| Param | Default | Max | Description |
|---|---|---|---|
| `page` | `1` | — | Page number (1-based) |
| `limit` | `20` | `100` | Deals per page |
| `activityLimit` | `10` | `50` | Recent activities per deal (`0` = none) |

```bash
curl "http://localhost:4000/api/deals?page=1&limit=5&activityLimit=3"
```

Response shape:
```json
{
  "data": [{
    "id": "uuid",
    "dealId": "deal-acme-001",
    "state": {
      "stage": "PROPOSAL",
      "amount": "120000",
      "closeDate": "2027-03-01T00:00:00.000Z"
    },
    "health": {
      "healthScore": 0.74,
      "riskLevel": "MEDIUM",
      "validationStatus": "SCORED",
      "aiReasoning": "Strong pain identification and champion confirmed...",
      "recommendedAction": "Schedule Economic Buyer introduction before next QBR.",
      "hygiene": {
        "cannotScore": false,
        "hygieneStatus": "PASS",
        "missingFields": [],
        "hygieneActions": [],
        "lastHygieneAt": "2026-06-07T10:00:01.000Z"
      }
    },
    "activities": [...],
    "activityCount": 8,
    "createdAt": "...",
    "updatedAt": "..."
  }],
  "pagination": {
    "page": 1, "limit": 5, "total": 4, "totalPages": 1, "hasMore": false
  }
}
```

`validationStatus` values: `PENDING` · `SCORED` · `HYGIENE_FAIL`
`hygieneStatus` values: `UNCHECKED` · `PASS` · `WARN` · `FAIL`

---

### `GET /api/deals/:dealId`

Single deal with full MEDDICC fields and paginated activities.

```bash
curl "http://localhost:4000/api/deals/deal-acme-001"
```

Returns `404` if the deal doesn't exist.

---

### `POST /api/webhook`

Ingest a deal event. Returns `202` immediately; processing is async.

**Required fields** (camelCase or snake_case):

| Field | Type | Description |
|---|---|---|
| `eventId` / `event_id` | string | Unique ID — used as BullMQ job ID for deduplication |
| `dealId` / `deal_id` | string | Deal identifier |
| `eventType` / `event_type` | enum | `stage_changed` · `email_sent` · `meeting_booked` · `note_added` · `deal_closed` |
| `payload` | object | Event data (stage, amount, close_date, notes, etc.) |

**Optional:**

| Field | Type | Description |
|---|---|---|
| `occurredAt` / `occurred_at` | ISO 8601 datetime | Source-system timestamp |

Responses: `202 { "accepted": true }` · `400` validation error · `500` server error

---

### `GET /api/events/stream`

Server-Sent Events stream. The frontend connects automatically.

```bash
curl -N http://localhost:4000/api/events/stream
```

| Event | Payload | Frequency |
|---|---|---|
| `connected` | `{ clientId, activeClients }` | Once on connect |
| `heartbeat` | `{ timestamp }` | Every 30 s |
| `deal-event-processed` | `{ eventId, dealId, eventType, processedAt }` | After each processed job |

---

## Queue monitor — Bull Board

Visit **http://localhost:4000/admin/queues** while the backend is running.

The dashboard shows:
- **Active / Waiting / Delayed / Paused** job counts in real time
- **Completed** tab — last 100 successfully processed jobs with payloads and timing
- **Failed** tab — last 500 failed jobs with full stack traces; click **Retry** to reprocess
- **Per-job detail** — input data, attempt count, processing duration, error message
- **Queue actions** — pause, resume, clean, empty the queue
- **Redis stats** — memory usage and connection health

Jobs are retried up to 3 times with 5 s exponential backoff before landing in Failed.

---

## AI scoring & hygiene engine

### How scoring works

Every time a deal event is processed, the AI engine runs two steps:

**1. Hygiene check** (`packages/ai-engine/src/hygiene.ts`)

Validates the deal has enough data quality to score. Checks are stage-aware:

| Check | When blocking |
|---|---|
| `stage` | Always — must not be missing or UNKNOWN |
| `amount` | Always — must be > 0 |
| `closeDate` | Always — must exist, be valid, and be in the future for non-CLOSED deals |
| `activities` | Always — must have at least one logged interaction |
| `meddicc.identifyPain` | Always — core qualification field |
| `meddicc.metrics` | Always — core qualification field |
| `meddicc.champion` | Always — critical people field |
| `meddicc.economicBuyer` | Late stages (Proposal, Negotiation, Closing) |
| `meddicc.decisionCriteria` | Late stages only |
| `meddicc.decisionProcess` | Late stages only |
| Source of truth conflict | When stage or amount differ >20% across CRM sources |
| Activity staleness | Stage-dependent: Negotiation = 7 days, Proposal = 14 days, etc. |

If any BLOCKING issue is found: `validationStatus = HYGIENE_FAIL`, full actionable guidance persisted.
If only WARNINGs: scoring proceeds, warnings attached to the result.

**2. OpenAI scoring** (`packages/ai-engine/src/index.ts`)

Sends a structured MEDDICC prompt to `gpt-4o-mini` at temperature 0.2. Returns:
- `score` — 0.0 to 1.0 (displayed as 0–100)
- `riskLevel` — `LOW` · `MEDIUM` · `HIGH`
- `reasoning` — paragraph explaining the score using MEDDICC dimensions
- `recommendedAction` — single most important next step for the rep

### What deals show on the dashboard

| `validationStatus` | What you see in the Deal Panel |
|---|---|
| `PENDING` | Score ring shows `—`, no risk badge |
| `HYGIENE_FAIL` | "Cannot Score" card, missing field chips, expandable action items |
| `SCORED` with warnings | Score ring, risk badge, AI reasoning, amber warning section below |
| `SCORED` clean | Score ring, risk badge, AI reasoning, recommended next step |

---

## Database

### Models

| Model | Purpose |
|---|---|
| `Deal` | Current state + AI health + MEDDICC fields |
| `Activity` | Immutable event log per deal |
| `ProcessedEvent` | Idempotency ledger (one row per eventId) |
| `DeadLetterEvent` | Reserved for failed-event archiving |

### Migrations

```bash
# After any schema.prisma change:
npm run prisma:generate -w @deal-radar/backend
npm run prisma:migrate -w @deal-radar/backend
```

### Inspect data directly

```bash
# Open a Postgres shell in Docker
docker exec -it deal-radar-postgres psql -U deal_radar -d deal_radar

# Useful queries
SELECT "dealId", stage, "validationStatus", "hygieneStatus", "healthScore" FROM "Deal";
SELECT "eventId", "dealId", "eventType", "occurredAt" FROM "Activity" ORDER BY "createdAt" DESC LIMIT 20;
SELECT COUNT(*) FROM "ProcessedEvent";
```

---

## Available scripts

Run from the **repository root** unless noted:

### Top-level

| Script | Description |
|---|---|
| `npm install` | Install all workspace dependencies |
| `npm run dev` | Start all workspace dev processes together |
| `npm run build` | Build all workspaces |
| `npm run mock` | Run the CRM mock event generator |

### Backend (`-w @deal-radar/backend`)

| Script | Description |
|---|---|
| `npm run dev -w @deal-radar/backend` | Start with hot reload (`tsx watch`) |
| `npm run build -w @deal-radar/backend` | Compile TypeScript to `dist/` |
| `npm run start -w @deal-radar/backend` | Run compiled production build |
| `npm run prisma:generate -w @deal-radar/backend` | Regenerate Prisma client |
| `npm run prisma:migrate -w @deal-radar/backend` | Apply pending migrations |

### Frontend (`-w @deal-radar/frontend`)

| Script | Description |
|---|---|
| `npm run dev -w @deal-radar/frontend` | Start Next.js dev server |
| `npm run build -w @deal-radar/frontend` | Build Next.js for production |
| `npm run start -w @deal-radar/frontend` | Serve production build |

### Docker Compose

| Command | Description |
|---|---|
| `docker compose up -d postgres redis` | Start Postgres + Redis in background |
| `docker compose up -d backend` | Start backend container too |
| `docker compose ps` | Check container status and health |
| `docker compose logs -f backend` | Follow backend container logs |
| `docker compose down` | Stop all containers |
| `docker compose down -v` | Stop and delete volumes (wipes all data) |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `❌ DATABASE_URL is required` | `.env` not loaded or `DATABASE_URL` missing | Check `apps/backend/.env` has `DATABASE_URL=...` |
| `❌ DATABASE_URL: Invalid input` | Same — env not found at startup | Ensure `apps/backend/.env` exists and is not empty |
| Backend won't start — Redis error | Redis not running | `docker compose up -d redis` |
| Backend won't start — DB error | Postgres not running | `docker compose up -d postgres` |
| Deals don't appear in dashboard | DB not migrated | Run `npm run prisma:migrate -w @deal-radar/backend` |
| Deals all show `HYGIENE_FAIL` | MEDDICC fields empty (expected) | This is correct — the mock generator doesn't populate MEDDICC. Update fields via SQL or the PATCH endpoint. |
| Deals show `HYGIENE_FAIL` — no score | Missing `OPENAI_API_KEY` | Add your OpenAI key to `apps/backend/.env` |
| Activity stream shows `disconnected` | Backend not running or wrong URL | Check `NEXT_PUBLIC_API_URL` in `.env` matches backend port |
| No events in Activity Stream | Mock generator not running | Run `npm run mock` in a separate terminal |
| `202` returned but no SSE event | Worker error | Check backend terminal for `[worker:deal-events]` error logs |
| Duplicate events not broadcasting | Working as designed | Idempotency is intentional — same `eventId` is a no-op |
| Frontend env changes not picked up | Next.js caches public env at startup | Restart `npm run dev -w @deal-radar/frontend` |
| Port 4000 in use | Another process | `lsof -i :4000` then kill it, or set `PORT=4001` in `apps/backend/.env` |
| Port 3000 in use | Another Next.js | Stop it, or run `npm run dev -w @deal-radar/frontend -- -p 3001` |

### Fully reset and start clean

```bash
docker compose down -v          # stop containers, wipe DB and Redis data
docker compose up -d postgres redis
npm run prisma:migrate -w @deal-radar/backend
npm run dev -w @deal-radar/backend
npm run dev -w @deal-radar/frontend
npm run mock
```

---

## License

Private — MVP project.
