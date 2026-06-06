import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import routes from './routes';
import { errorHandler } from './middlewares/error';
import { registerDealEventsWorker } from './queues';

const app = express();
const port = parseInt(env.PORT, 10);

registerDealEventsWorker();

// ---------------------------------------------------------------------------
// Middlewares
// ---------------------------------------------------------------------------

// Bull Board serves its own static assets with inline scripts/styles —
// disable CSP only for the /admin path so the dashboard renders correctly.
app.use('/admin', helmet({ contentSecurityPolicy: false }));
app.use(
  /^(?!\/admin)/,
  helmet(),
);

app.use(cors());
app.use(express.json());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use(routes);

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Backend server listening on port ${port} in ${env.NODE_ENV} mode`);
  console.log(`Bull Board:  http://localhost:${port}/admin/queues`);
});

