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

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Routes
app.use(routes);

// Error Handling Middleware
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Backend server listening on port ${port} in ${env.NODE_ENV} mode`);
});

