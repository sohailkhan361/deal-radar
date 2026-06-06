/**
 * Bull Board admin route — mounted at /admin/queues
 *
 * Exposes a real-time dashboard for all BullMQ queues:
 *   - Active / waiting / completed / failed / delayed job counts
 *   - Per-job retry history and stack traces
 *   - Queue health (paused, rate-limited, Redis connection)
 *   - Manual retry / promote / clean actions
 */

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Router } from 'express';
import { dealEventsQueue } from '../queues';

// ---------------------------------------------------------------------------
// Server adapter — base path must match where the router is mounted
// ---------------------------------------------------------------------------

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// ---------------------------------------------------------------------------
// Register all queues
// Add more BullMQAdapter entries here as new queues are created.
// ---------------------------------------------------------------------------

createBullBoard({
  queues: [new BullMQAdapter(dealEventsQueue)],
  serverAdapter,
  options: {
    uiConfig: {
      boardTitle: 'Deal Radar — Queue Monitor',
      boardLogo: {
        path: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2306b6d4"%3E%3Ccircle cx="12" cy="12" r="10" stroke="%2306b6d4" stroke-width="2" fill="none"/%3E%3Ccircle cx="12" cy="12" r="5" fill="%2306b6d4" opacity=".4"/%3E%3Ccircle cx="12" cy="12" r="2" fill="%2306b6d4"/%3E%3C/svg%3E',
        width: 28,
        height: 28,
      },
      miscLinks: [
        { text: 'API Docs', url: '/health' },
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// Router — forward all /admin/queues/* requests to Bull Board
// ---------------------------------------------------------------------------

const router = Router();

router.use('/', serverAdapter.getRouter());

export default router;
