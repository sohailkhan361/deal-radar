import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

export const dealQueue = new Queue('deal-processing', { connection });

export const dealWorker = new Worker('deal-processing', async job => {
  console.log(`Processing job ${job.id}`);
  // Add actual job processing logic here
}, { connection });
