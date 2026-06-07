# Deal Radar — Presentation Transcript

## Before we dive in

Make sure everything is running:

```bash
# Terminal 1 — infra (already running)
docker compose up -d postgres redis

# Terminal 2 — backend
npm run dev -w @deal-radar/backend

# Terminal 3 — frontend
npm run dev -w @deal-radar/frontend

# Terminal 4 — for mock events stream
```

Tabs open in your browser:
- **Tab 1** — http://localhost:3000 (dashboard)
- **Tab 2** — http://localhost:4000/admin/queues (Bull Board)
- **Tab 3** — http://localhost:4000/health (health check)

---

## Section 1 — Hook

**Screen: Dashboard at http://localhost:3000 — empty state**

> "This is Deal Radar — a real-time AI co-pilot for B2B sales pipelines."

> "Most CRM tools are passive. They store data, but they don't tell you which deals are at risk right now, which ones are missing critical qualification data, or what your rep should do next."

> "Deal Radar changes that. It watches your pipeline in real time, enforces MEDDICC data quality on every deal, and scores each opportunity with AI — surfacing health scores, risk levels, and concrete next steps directly on the dashboard."

---

## Section 2 — Architecture overview

> "The system is built as a full-stack TypeScript monorepo."

> "On the left is a Next.js frontend. On the right, an Express backend. Between them, a Redis-backed BullMQ job queue, and a PostgreSQL database managed by Prisma."

> "Events flow in from any CRM — or in our case, a mock generator — through a webhook endpoint. The webhook returns 202 immediately, and all processing happens asynchronously in a background worker."

> "The worker deduplicates events, updates deal state, logs activity history, runs AI scoring, and pushes results to the browser over Server-Sent Events — all in a single atomic database transaction."

> "Let's bring it to life."

---

## Section 3 — Start the mock generator, show Activity Stream

**Screen: Dashboard — Activity Stream panel on the left**

Switch to Terminal 4 and run:
```bash
npm run mock
```

> "We're running the mock CRM event generator. It's sending a random deal event every two seconds — stage changes, emails, meeting bookings, notes — for four deals in our pipeline."

> "Every card you see here is a real event that has been validated, queued, processed, and broadcast to this browser over a persistent Server-Sent Events connection. No polling. No page refresh."

Point at the connection status badge (top right of Activity Stream).

> "That green 'connected' badge tells us the SSE connection is live. If the backend goes down, it flips to 'disconnected' — and when it comes back, the frontend reconnects automatically."

Click the filter chips to show filtering.

> "We can filter by event type — show me only stage changes, or only meetings. And We can pause the stream to inspect a specific event without losing the buffer."

---

## Section 4 — Deal Panel, hygiene failure state

**Screen: Deal Panel on the right side of the dashboard**

> "Over here is the Deal Panel. As events come in, deals are being created and scored automatically."

> "You'll notice these deals are showing a 'Cannot Score' state. That's the MEDDICC hygiene enforcement kicking in."

Expand a deal card to show the hygiene card.

> "MEDDICC is the industry-standard B2B qualification framework — Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion, Competition."

> "Deal Radar checks every deal against these criteria before it even touches the AI. The mock generator intentionally sends events without MEDDICC data — because that's exactly what happens when a rep hasn't updated their CRM."

Point at the missing field chips.

> "These red chips are the blocking issues. Each one tells you exactly which field is missing."

Expand one of the blocking items.

> "And when you expand an action item, you get a concrete, rep-facing instruction — not just 'fill this in', but specifically what to do and why it matters."

> "This is the hygiene enforcement system. It doesn't just score deals — it coaches reps on what data they need to close."

---

## Section 5 — Simulate a scored deal

**Screen: Terminal, then back to dashboard**

Stop the mock generator with Ctrl+C. Switch to a terminal and paste this:

```bash
curl -X POST http://localhost:4000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt-demo-score-001",
    "deal_id": "deal-demo-scored",
    "event_type": "stage_changed",
    "occurred_at": "2026-06-07T10:00:00.000Z",
    "payload": {
      "stage": "PROPOSAL",
      "amount": 120000,
      "close_date": "2027-03-01T00:00:00.000Z"
    }
  }'
```

> "Let me send a deal event manually — this one has a stage, amount, and close date set correctly."

Now update MEDDICC in Postgres:

```bash
docker exec -it deal-radar-postgres psql -U deal_radar -d deal_radar -c "
UPDATE \"Deal\"
SET
  \"meddiccIdentifyPain\" = 'Manual reporting costs the ops team 40 hours per week',
  \"meddiccMetrics\" = '200k annual saving, 40h per week reclaimed across 3 teams',
  \"meddiccChampion\" = 'Sarah Chen, VP Engineering — committed to presenting to CFO',
  \"meddiccEconomicBuyer\" = 'James Park, CFO — meeting scheduled for next Thursday',
  \"meddiccDecisionCriteria\" = 'SOC2 compliance, Salesforce integration, sub-12-month ROI',
  \"meddiccDecisionProcess\" = 'Sarah presents to CFO, legal reviews DPA, PO by end of Q3'
WHERE \"dealId\" = 'deal-demo-scored';
"
```

> "We're now populating the MEDDICC fields directly — in a real integration, these would come from your CRM's deal record."

Sending a trigger event:

```bash
curl -X POST http://localhost:4000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt-demo-score-002",
    "deal_id": "deal-demo-scored",
    "event_type": "meeting_booked",
    "occurred_at": "2026-06-07T10:05:00.000Z",
    "payload": { "title": "Economic Buyer intro call" }
  }'
```

> "We'll trigger a rescore by sending another event."

Switch back to the dashboard and watch the deal update.

> "The hygiene checks all pass. The deal goes to OpenAI. And within a couple of seconds..."

Point at the score ring animating in.

> "We have a health score. A risk level. And AI reasoning grounded in MEDDICC."

Expand the deal card fully.

> "The AI explains exactly why this deal scored the way it did — which MEDDICC dimensions are strong, which are weak, and what to do next. That recommended action is specific and actionable, not generic advice."

---

## Section 6 — Bull Board

**Screen: http://localhost:4000/admin/queues**

Switch to Tab 2.

> "Behind all of this is a production-grade job queue powered by BullMQ and Redis."

> "This is Bull Board — the queue monitoring dashboard. It's built right into the application, no extra tooling required."

Click through the tabs.

> "I can see every job that's been processed — the payload, how long it took, how many attempts it needed. The Failed tab shows any jobs that exhausted all retries, with the full stack trace. I can retry them with one click."

> "The queue uses exponential backoff — if a job fails, it waits 5 seconds, then 10, then 20 before giving up. That means transient database errors or OpenAI timeouts don't cause data loss."

Point at Redis stats.

> "And down here, real-time Redis memory and connection stats. This is what an ops team needs on a Monday morning."

---

## Section 7 — Health check and graceful shutdown

**Screen: http://localhost:4000/health**

Switch to Tab 3.

> "The health endpoint isn't just returning 'ok' — it's actually pinging the database and returning a structured response with each service's status. A load balancer can use this to pull the server out of rotation if Postgres goes down."

Back to the dashboard.

> "If I shut the backend down with Ctrl+C, the server doesn't drop connections mid-request. It stops accepting new traffic, waits for the active BullMQ job to finish, then disconnects cleanly from Postgres. No data loss, no orphaned jobs."

---

## Section 8 — Technical summary

**Screen: Dashboard or code editor — your choice**

> "Let me summarise the technology choices and why they were made."

> "The entire stack is TypeScript, end to end. The backend, frontend, AI engine, and shared types are all one monorepo. That means the API response shape, the hygiene action types, the SSE event payloads — all defined once, referenced everywhere. The compiler catches drift before it hits production."

> "BullMQ over Kafka for this scale. It gives you at-least-once delivery, retries, visibility, and dead-letter support without the operational overhead of a Kafka cluster. For this pipeline volume, it's the right tool."

> "Prisma over raw SQL. The deal mapper converts Prisma's typed rows directly to the API response types — zero `any` casts between the database and the wire. The `hygieneActions` JSON column stores the full action list as a validated, typed blob — always read and written as a unit, no join complexity."

> "MEDDICC hygiene as deterministic rules, not AI prompts. Failures are explainable, reproducible, and specific. A rep gets told 'Economic Buyer is missing for a Proposal-stage deal' — not a vague AI suggestion. Only after the deterministic gates pass does the AI get involved."

> "TanStack Query and Zustand as two separate concerns. Zustand owns the real-time SSE stream. TanStack Query owns the REST data. They're connected by a single effect in useDeals that invalidates the query 1.2 seconds after any deal-event-processed SSE arrives. Clean separation, no re-render cascades."

---

## Section 9 — Close

**Screen: Dashboard with a mix of scored and hygiene-failed deals**

Restart the mock generator:
```bash
npm run mock
```

> "Deal Radar demonstrates how modern sales tooling should work — not a passive data store, but an active system that watches your pipeline, enforces qualification standards, and tells you exactly where to focus."

> "Real-time event ingestion. Async processing with a resilient queue. AI scoring grounded in a structured methodology. Live dashboard updates without polling. And full operational visibility built in."

> "Everything here is production-hardened — typed end to end, graceful shutdown, error boundaries, retry logic, idempotency — not just a demo that works once."

> "Thank you."
