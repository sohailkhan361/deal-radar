<img width="1352" height="804" alt="Screenshot 2026-06-06 at 9 06 32 PM" src="https://github.com/user-attachments/assets/b12f4596-8245-40b3-bd1d-ec0dcff52abe" /># Deal Radar

Deal Radar is a real-time deal tracking platform that ingests CRM events, processes them asynchronously, persists deal state, and streams live updates to a dashboard.

The system is built as an npm monorepo with an Express backend, a Next.js frontend, shared packages, and a mock CRM event generator for local development.

---

## Table of contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [What each part does](#what-each-part-does)
- [Prerequisites](#prerequisites)
- [Environment variables](#environment-variables)
- [Quick start](#quick-start)
- [Running the application](#running-the-application)
- [Mock event generator](#mock-event-generator)
- [API reference](#api-reference)
- [Live activity stream (SSE)](#live-activity-stream-sse)
- [Database](#database)
- [Debugging](#debugging)
- [Available scripts](#available-scripts)
- [Troubleshooting](#troubleshooting)

---

## What it does

Deal Radar watches sales pipeline activity in near real time:

1. **Ingest** — CRM systems POST deal events to a webhook endpoint.
2. **Queue** — Events are enqueued in Redis (BullMQ) for reliable, async processing.
3. **Process** — A background worker validates idempotency, upserts deals, saves activity history, and updates deal fields (stage, amount, close date).
4. **Broadcast** — Successfully processed events are pushed to connected browsers via Server-Sent Events (SSE).
5. **Display** — The frontend dashboard shows a live activity feed with pause/resume, filtering, and auto-scroll.

The right-hand **Deal Panel** and top **Filters** bar are currently static UI previews. The **Activity Stream** is wired to live SSE data.

---

## Architecture

```mermaid
flowchart TB
  subgraph external [External]
    CRM[CRM / Mock Generator]
  end

  subgraph frontend [Frontend — Next.js :3000]
    UI[Activity Stream Dashboard]
    SSEClient[SSE Client + Zustand Store]
    UI --> SSEClient
  end

  subgraph backend [Backend — Express :4000]
    Webhook[POST /api/webhook]
    SSE[SSE /api/events/stream]
    Worker[BullMQ Worker]
    Webhook --> Queue
    Worker --> DB
    Worker --> SSE
  end

  subgraph infra [Infrastructure]
    Redis[(Redis :6379)]
    Postgres[(Postgres :5432)]
    Queue[BullMQ Queue]
  end

  CRM -->|deal events| Webhook
  Webhook --> Queue
  Queue --> Redis
  Worker --> Redis
  Worker --> Postgres
  SSEClient -->|EventSource| SSE
  SSE --> UI
```

### Event lifecycle

```mermaid
sequenceDiagram
  participant Mock as Mock Generator
  participant API as Backend API
  participant Redis as Redis Queue
  participant Worker as BullMQ Worker
  participant DB as Postgres
  participant SSE as SSE Stream
  participant UI as Frontend

  Mock->>API: POST /api/webhook
  API->>Redis: Enqueue job (jobId = eventId)
  API-->>Mock: 202 Accepted

  Worker->>Redis: Dequeue job
  Worker->>DB: Check idempotency (ProcessedEvent)
  Worker->>DB: Upsert Deal + save Activity
  Worker->>DB: Update deal stage/amount/closeDate
  Worker->>SSE: broadcast deal-event-processed
  SSE-->>UI: SSE event
  UI->>UI: Store in Zustand (max 1000 events)
```

---

## Repository structure

```
deal-radar/
├── apps/
│   ├── backend/          # Express API, webhook, SSE, BullMQ worker, Prisma
│   └── frontend/         # Next.js dashboard (Activity Stream, Deal Panel)
├── packages/
│   ├── shared-types/   # Shared TypeScript types (Deal, SSE payloads)
│   ├── validation-engine/  # Zod schemas (placeholder / future use)
│   └── ai-engine/        # AI processing stub (placeholder / future use)
├── scripts/
│   └── mock-generator.ts # Sends fake CRM events to the webhook
├── docker-compose.yml    # Postgres, Redis, and optional backend container
├── .env.example          # Environment variable template
└── package.json          # Root workspace scripts
```

---

## What each part does

### Backend (`apps/backend`)

| Component | Path | Responsibility |
|---|---|---|
| **Webhook** | `src/controllers/webhook.controller.ts` | Validates incoming deal events (snake_case or camelCase), enqueues to BullMQ |
| **Worker** | `src/queues/worker.ts` | Processes jobs: deduplication, deal upsert, activity logging, SSE broadcast |
| **SSE stream** | `src/sse/event-stream.ts` | Manages connected clients, heartbeats every 30s, broadcasts processed events |
| **Deal service** | `src/services/deal.service.ts` | Creates/updates deals from event payloads, serves deal queries |
| **Deal controller** | `src/controllers/deal.controller.ts` | Paginated deal list and deal detail endpoints |
| **Activity service** | `src/services/activity.service.ts` | Persists activity records and tracks processed event IDs |
| **Prisma** | `prisma/schema.prisma` | Postgres models: `Deal`, `Activity`, `ProcessedEvent`, `DeadLetterEvent` |

**API routes:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/deals` | Paginated deal list with state, health, and activities |
| `GET` | `/api/deals/:dealId` | Single deal with state, health, and paginated activities |
| `POST` | `/api/webhook` | Ingest CRM deal events |
| `GET` | `/api/events/stream` | SSE live event stream |

### Frontend (`apps/frontend`)

| Component | Path | Responsibility |
|---|---|---|
| **Activity Stream** | `src/components/dashboard/ActivityStream.tsx` | Live feed UI with pause, resume, filter, auto-scroll |
| **SSE client** | `src/lib/sse-client.ts` | `EventSource` connection to backend stream |
| **Zustand store** | `src/store/event-stream.ts` | Stores up to 1000 events, connection state, filters |
| **useEventStream** | `src/hooks/useEventStream.ts` | React hook that manages connect/disconnect lifecycle |
| **Deal Panel** | `src/components/dashboard/DealPanel.tsx` | Static pipeline health preview (not yet live) |
| **Filters** | `src/components/dashboard/Filters.tsx` | Static search/filter UI (not yet live) |

### Shared packages

| Package | Purpose |
|---|---|
| `@deal-radar/shared-types` | `Deal` interface, SSE event types, `DealEventType` union |
| `@deal-radar/validation-engine` | Zod `DealSchema` — reserved for future validation flows |
| `@deal-radar/ai-engine` | `processDealWithAI` stub — reserved for future AI scoring |

### Mock generator (`scripts/mock-generator.ts`)

Simulates a CRM pushing events to the webhook. Randomly generates scenarios:

| Scenario | Description |
|---|---|
| `normal_event` | Standard random deal event |
| `duplicate_event` | Replays the previous event (tests idempotency) |
| `missing_activity_history` | Event for a deal with no prior history |
| `source_of_truth_conflict` | Conflicting stage/amount from multiple sources |
| `out_of_order_event` | Event with an older `occurred_at` timestamp |

### Infrastructure

| Service | Role |
|---|---|
| **Postgres** | Persistent storage for deals, activities, processed events |
| **Redis** | BullMQ job queue backing store |

---

## Prerequisites

- **Node.js 20+**
- **npm** (workspaces enabled at root)
- **Docker** (recommended for Postgres and Redis)

Optional:

- `curl` or Postman for API testing
- `tsx` (installed via root `devDependencies` for the mock script)

---

## Environment variables

Copy the example file and adjust for your setup:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Runtime environment |
| `PORT` | `4000` | Backend listen port |
| `BACKEND_PORT` | `4000` | Host port mapped in Docker Compose |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend URL used by the frontend SSE client |
| `DATABASE_URL` | *(see `.env.example`)* | Postgres connection string |
| `REDIS_HOST` | `redis` (Docker) / `localhost` (local) | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `POSTGRES_*` | *(see `.env.example`)* | Postgres credentials for Docker Compose |
| `MOCK_WEBHOOK_URL` | `http://localhost:4000/api/webhook` | Override webhook target for mock generator |
| `MOCK_INTERVAL_MS` | `2000` | Milliseconds between mock events |
| `CHOKIDAR_USEPOLLING` | `true` | File watching inside Docker |

### Local development `.env` tips

When running the **backend on your machine** (not inside Docker), use `localhost` for data stores:

```env
DATABASE_URL=postgresql://deal_radar:deal_radar_password@localhost:5432/deal_radar?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
NEXT_PUBLIC_API_URL=http://localhost:4000
PORT=4000
```

When running the **backend inside Docker Compose**, keep `DATABASE_URL` pointing at the `postgres` service hostname (as in `.env.example`).

> Restart the frontend after changing `NEXT_PUBLIC_API_URL` — Next.js reads public env vars at build/start time.

---

## Quick start

From the repository root:

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env if needed (see above)

# 3. Start Postgres + Redis
docker compose up -d postgres redis

# 4. Prepare database
npm run prisma:generate -w @deal-radar/backend
npm run prisma:migrate -w @deal-radar/backend

# 5. Start backend (terminal 1)
npm run dev -w @deal-radar/backend

# 6. Start frontend (terminal 2)
npm run dev -w @deal-radar/frontend

# 7. Start mock events (terminal 3)
npm run mock
```

Open **http://localhost:3000** — you should see live events in the Activity Stream.

Verify the backend:

```bash
curl http://localhost:4000/health
# {"status":"ok"}
```

---

## Running the application

### Option A — Recommended local dev (hybrid)

Use Docker for infrastructure, run app processes locally for fast iteration.

**Terminal 1 — Infrastructure (once)**

```bash
docker compose up -d postgres redis
```

**Terminal 2 — Backend**

```bash
npm run dev -w @deal-radar/backend
```

**Terminal 3 — Frontend**

```bash
npm run dev -w @deal-radar/frontend
```

**Terminal 4 — Mock data**

```bash
npm run mock
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Health check | http://localhost:4000/health |
| SSE stream | http://localhost:4000/api/events/stream |
| Webhook | http://localhost:4000/api/webhook |

### Option B — Backend in Docker

Docker Compose can run Postgres, Redis, and the backend together. The frontend still runs locally.

```bash
docker compose up -d postgres redis
npm run prisma:migrate -w @deal-radar/backend   # run from host first
docker compose up backend
npm run dev -w @deal-radar/frontend
npm run mock
```

> Docker Compose runs `prisma generate` on backend startup but does **not** run migrations. Always migrate before processing events.

### Option C — Run all workspaces

Starts every workspace `dev` script (backend, frontend, and packages):

```bash
npm run dev
```

This is convenient but noisier. Separate terminals are easier when debugging.

### Production build

```bash
npm run build
npm run start -w @deal-radar/backend
npm run start -w @deal-radar/frontend
```

---

## Mock event generator

The mock script simulates CRM webhook traffic.

### Basic usage

```bash
npm run mock
```

Posts a random event to `http://localhost:4000/api/webhook` every 2 seconds.

### Options

```bash
# Preview payloads without sending
npm run mock -- --dry-run

# Send a fixed number of events then exit
npm run mock -- --count=10

# Custom interval (5 seconds)
MOCK_INTERVAL_MS=5000 npm run mock

# Custom webhook URL
MOCK_WEBHOOK_URL=http://localhost:4000/api/webhook npm run mock
```

### Supported event types

`stage_changed` · `email_sent` · `meeting_booked` · `note_added`

The backend also accepts `deal_closed` (not yet generated by the mock script).

### Manual webhook test

```bash
curl -X POST http://localhost:4000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt-manual-001",
    "deal_id": "deal-acme-001",
    "event_type": "stage_changed",
    "occurred_at": "2026-06-06T12:00:00.000Z",
    "payload": {
      "stage": "PROPOSAL",
      "amount": 120000,
      "close_date": "2026-07-01T00:00:00.000Z"
    }
  }'
```

Expected response: `202` with `{"accepted":true}`.

The API accepts both **snake_case** (`event_id`, `deal_id`) and **camelCase** (`eventId`, `dealId`) field names.

---

## API reference

### `GET /health`

Returns server status.

```json
{ "status": "ok" }
```

### `GET /api/deals`

Returns a paginated list of deals with current state, health fields, and recent activities.

**Query parameters:**

| Param | Default | Max | Description |
|---|---|---|---|
| `page` | `1` | — | Page number (1-based) |
| `limit` | `20` | `100` | Deals per page |
| `activityLimit` | `10` | `50` | Recent activities included per deal (`0` for none) |

**Example:**

```bash
curl "http://localhost:4000/api/deals?page=1&limit=20&activityLimit=10"
```

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "dealId": "deal-acme-001",
      "state": {
        "stage": "PROPOSAL",
        "amount": "120000",
        "closeDate": "2026-07-01T00:00:00.000Z"
      },
      "health": {
        "healthScore": null,
        "riskLevel": null,
        "validationStatus": "PENDING",
        "aiReasoning": null
      },
      "activities": [
        {
          "id": "uuid",
          "eventId": "evt-001",
          "eventType": "stage_changed",
          "payload": {},
          "occurredAt": "2026-06-06T12:00:00.000Z",
          "createdAt": "2026-06-06T12:00:01.000Z"
        }
      ],
      "activityCount": 15,
      "createdAt": "2026-06-06T10:00:00.000Z",
      "updatedAt": "2026-06-06T12:00:01.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 4,
    "totalPages": 1,
    "hasMore": false
  }
}
```

### `GET /api/deals/:dealId`

Returns a single deal with current state, health fields, and paginated activities.

**Query parameters:**

| Param | Default | Max | Description |
|---|---|---|---|
| `page` | `1` | — | Activity page number (1-based) |
| `limit` | `20` | `100` | Activities per page |

**Example:**

```bash
curl "http://localhost:4000/api/deals/deal-acme-001?page=1&limit=20"
```

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "dealId": "deal-acme-001",
    "state": {
      "stage": "PROPOSAL",
      "amount": "120000",
      "closeDate": "2026-07-01T00:00:00.000Z"
    },
    "health": {
      "healthScore": null,
      "riskLevel": null,
      "validationStatus": "PENDING",
      "aiReasoning": null
    },
    "activities": [],
    "createdAt": "2026-06-06T10:00:00.000Z",
    "updatedAt": "2026-06-06T12:00:01.000Z"
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1,
    "hasMore": false
  }
}
```

**Responses:**

| Status | Meaning |
|---|---|
| `200` | Deal found |
| `400` | Invalid pagination parameters |
| `404` | Deal not found |

### `POST /api/webhook`

Accepts a deal event and enqueues it for processing.

**Required fields** (either naming style):

| Field | Type | Description |
|---|---|---|
| `eventId` / `event_id` | string | Unique event identifier (used as BullMQ job ID) |
| `dealId` / `deal_id` | string | Deal identifier |
| `eventType` / `event_type` | enum | `stage_changed`, `email_sent`, `meeting_booked`, `note_added`, `deal_closed` |
| `payload` | object | Event-specific data |

**Optional:**

| Field | Type | Description |
|---|---|---|
| `occurredAt` / `occurred_at` | ISO datetime | When the event happened in the source system |

**Responses:**

| Status | Meaning |
|---|---|
| `202` | Event accepted and enqueued |
| `400` | Invalid payload (validation error details included) |
| `500` | Server error |

### `GET /api/events/stream`

Server-Sent Events endpoint. Connect with `EventSource` or `curl`:

```bash
curl -N http://localhost:4000/api/events/stream
```

**SSE event types:**

| Event | Payload | Description |
|---|---|---|
| `connected` | `{ clientId, activeClients }` | Sent when client connects |
| `heartbeat` | `{ timestamp }` | Sent every 30 seconds |
| `deal-event-processed` | `{ eventId, dealId, eventType, processedAt }` | Sent after successful worker processing |

---

## Live activity stream (SSE)

The frontend connects automatically when the dashboard loads.

### Features

| Feature | Description |
|---|---|
| **Pause** | Closes the SSE connection; buffered events are kept |
| **Resume** | Reconnects to the stream |
| **Filter by event type** | Show all events or a single type (`stage_changed`, `email_sent`, etc.) |
| **Auto-scroll** | Scrolls to the newest event when new data arrives |
| **1000 event cap** | Only the most recent 1000 events are kept in memory |

### Key files

```
apps/frontend/src/
├── lib/sse-client.ts           # EventSource singleton
├── store/event-stream.ts       # Zustand store
├── hooks/useEventStream.ts     # Connection lifecycle hook
└── components/dashboard/
    └── ActivityStream.tsx      # UI
```

### Connection status badge

| Status | Meaning |
|---|---|
| `connecting` | Opening SSE connection |
| `connected` | Receiving events |
| `paused` | User paused the stream |
| `disconnected` | Connection lost or backend unavailable |

---

## Database

### Models

| Model | Purpose |
|---|---|
| `Deal` | Current deal state (stage, amount, close date, health fields) |
| `Activity` | Immutable log of every processed event |
| `ProcessedEvent` | Idempotency ledger — prevents duplicate processing |
| `DeadLetterEvent` | Reserved for failed events (schema present, not yet wired) |

### Migrations

```bash
# Generate Prisma client after schema changes
npm run prisma:generate -w @deal-radar/backend

# Apply migrations (development)
npm run prisma:migrate -w @deal-radar/backend
```

### Inspect data

```bash
# Connect to Postgres inside Docker
docker exec -it deal-radar-postgres psql -U deal_radar -d deal_radar

# Example queries
SELECT "dealId", stage, amount FROM "Deal";
SELECT "eventId", "dealId", "eventType" FROM "Activity" ORDER BY "createdAt" DESC LIMIT 10;
```

---

## Debugging

### 1. Confirm services are running

```bash
docker compose ps
curl http://localhost:4000/health
```

### 2. Watch backend logs

The backend logs key steps with prefixed tags:

| Log prefix | What to look for |
|---|---|
| `[webhook]` | Incoming events and enqueue status |
| `[queue:deal-events]` | Queue registration and errors |
| `[worker:deal-events]` | Job processing, duplicates, failures |
| `[sse]` | Client connect/disconnect |

```bash
npm run dev -w @deal-radar/backend
```

### 3. Test the webhook in isolation

```bash
npm run mock -- --count=1
```

Check backend terminal for:

```
[webhook] Deal event enqueued
[worker:deal-events] Event processed
[sse] Client connected
```

### 4. Test SSE directly

```bash
curl -N http://localhost:4000/api/events/stream
```

In another terminal, send an event:

```bash
npm run mock -- --count=1
```

You should see `event: deal-event-processed` in the curl output.

### 5. Check Redis queue

```bash
docker exec -it deal-radar-redis redis-cli

# List BullMQ keys
KEYS bull:deal-events:*
```

### 6. Frontend debugging

- Open browser DevTools → **Network** → filter by `stream` or `events`
- The SSE request should stay open with status `200`
- Check the **Console** for `[sse]` parse errors
- Verify `NEXT_PUBLIC_API_URL` in `.env` matches the running backend

### 7. Dry-run mock payloads

```bash
npm run mock -- --dry-run --count=3
```

Inspect generated JSON without hitting the API.

### 8. Duplicate event handling

The mock `duplicate_event` scenario replays the last event. The worker should log:

```
[worker:deal-events] Skipping duplicate event
```

No second `deal-event-processed` SSE event should appear for the same `eventId`.

---

## Available scripts

Run from the **repository root**:

| Script | Description |
|---|---|
| `npm install` | Install all workspace dependencies |
| `npm run dev` | Start all workspace dev processes |
| `npm run build` | Build all workspaces |
| `npm run start` | Start all workspaces in production mode |
| `npm run lint` | Lint all workspaces |
| `npm run mock` | Run the CRM mock event generator |

### Workspace-specific

| Script | Description |
|---|---|
| `npm run dev -w @deal-radar/backend` | Start backend with hot reload (`tsx watch`) |
| `npm run dev -w @deal-radar/frontend` | Start Next.js dev server |
| `npm run build -w @deal-radar/backend` | Compile backend TypeScript |
| `npm run build -w @deal-radar/frontend` | Build Next.js for production |
| `npm run prisma:generate -w @deal-radar/backend` | Generate Prisma client |
| `npm run prisma:migrate -w @deal-radar/backend` | Run database migrations |

### Docker Compose

| Command | Description |
|---|---|
| `docker compose up -d postgres redis` | Start Postgres and Redis in background |
| `docker compose up backend` | Start backend container (with deps) |
| `docker compose down` | Stop all containers |
| `docker compose down -v` | Stop containers and delete volumes (wipes DB data) |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No events in Activity Stream | Mock or backend not running | Start backend + `npm run mock`; check backend logs |
| SSE shows `disconnected` | Backend down or wrong URL | Verify `curl http://localhost:4000/health` and `NEXT_PUBLIC_API_URL` |
| `Redis connection` errors | Redis not running | `docker compose up -d redis`; set `REDIS_HOST=localhost` for local backend |
| Prisma / Postgres errors | DB not migrated | Run `prisma:migrate`; check `DATABASE_URL` uses `localhost` for local backend |
| `202` but no SSE event | Worker failed silently | Check `[worker:deal-events]` logs for errors |
| Duplicate events not showing | Working as designed | Idempotency skips re-processing; only first event broadcasts |
| Frontend env changes ignored | Next.js caches public env | Restart `npm run dev -w @deal-radar/frontend` |
| Port 4000 already in use | Another process bound | `lsof -i :4000` and stop the conflicting process |
| Port 3000 already in use | Another Next.js instance | `npx next dev -p 3001` or stop the other process |
| Docker backend can't reach DB | Migration not applied | Run migrations from host before starting backend container |
| CORS errors | Backend CORS misconfigured | Backend uses `cors()` with defaults — ensure API URL is correct |

### Reset everything

```bash
docker compose down -v
docker compose up -d postgres redis
docker compose up backend

curl http://localhost:4000/health

npm run prisma:migrate -w @deal-radar/backend
```

Then restart backend, frontend, and mock.

---

## Supported deal event types

| Type | Effect on deal |
|---|---|
| `stage_changed` | Updates `stage` from payload (`stage`, `new_stage`, etc.) |
| `email_sent` | Logged as activity; no stage change |
| `meeting_booked` | Logged as activity; no stage change |
| `note_added` | Logged as activity; no stage change |
| `deal_closed` | Sets stage to `CLOSED` |

Payload fields commonly used for deal updates: `amount`, `close_date`, `stage`, `new_stage`.

---

## License

Private — POC project.

## Screenshots
<img width="1352" height="804" alt="Screenshot 2026-06-06 at 9 06 32 PM" src="https://github.com/user-attachments/assets/6fe29dcd-b6b2-489d-b194-988051213156" /><img width="1352" height="805" alt="Screenshot 2026-06-06 at 9 07 20 PM" src="https://github.com/user-attachments/assets/c5b4c493-ea2b-4bae-a579-ee6b805fc4cf" />
<img width="1352" height="803" alt="Screenshot 2026-06-06 at 9 07 11 PM" src="https://github.com/user-attachments/assets/971db0bd-41e5-495b-b32b-f0e87f529622" />
<img width="1352" height="806" alt="Screenshot 2026-06-06 at 9 06 52 PM" src="https://github.com/user-attachments/assets/5ba5ec5b-a306-4b91-b315-5976e4fe53d2" />
<img width="1352" height="803" alt="Screenshot 2026-06-06 at 9 06 41 PM" src="https://github.com/user-attachments/assets/c63a6e72-a231-4c8f-aa4c-c939474467ba" />

