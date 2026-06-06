// Load .env before any other import — env.ts reads process.env at module
// evaluation time, so dotenv must run first.
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import routes from './routes';
import { errorHandler } from './middlewares/error';
import { closeDealEventsWorker, registerDealEventsWorker } from './queues';
import prisma from './services/prisma.service';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const app = express();
const port = parseInt(env.PORT, 10);

registerDealEventsWorker();

// ---------------------------------------------------------------------------
// Security & logging middleware
// ---------------------------------------------------------------------------

// Bull Board serves its own static assets (inline scripts + styles).
// Disable CSP only for /admin so the UI renders; keep full helmet elsewhere.
app.use('/admin', helmet({ contentSecurityPolicy: false }));
app.use(/^(?!\/admin)/, helmet());

app.use(cors());
app.use(express.json());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use(routes);

// ---------------------------------------------------------------------------
// Global error handler — must be last
// ---------------------------------------------------------------------------

app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const server = app.listen(port, () => {
  console.log(`[server] Listening on port ${port} (${env.NODE_ENV})`);
  console.log(`[server] Health    → http://localhost:${port}/health`);
  console.log(`[server] Bull Board → http://localhost:${port}/admin/queues`);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// Stops accepting new connections, waits for the active BullMQ job to finish,
// then disconnects Prisma cleanly.
// ---------------------------------------------------------------------------

const shutdown = async (signal: string): Promise<void> => {
  console.log(`[server] ${signal} received — starting graceful shutdown`);

  server.close(async () => {
    try {
      await closeDealEventsWorker();
      await prisma.$disconnect();
      console.log('[server] Shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error('[server] Error during shutdown', err);
      process.exit(1);
    }
  });

  // Force-exit if shutdown takes too long (e.g. stuck job)
  setTimeout(() => {
    console.error('[server] Shutdown timeout — forcing exit');
    process.exit(1);
  }, 15_000).unref();
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
