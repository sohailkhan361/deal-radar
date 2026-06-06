import { Queue, Worker, type JobsOptions, type Processor, type QueueOptions, type WorkerOptions } from 'bullmq';
import { type RedisOptions } from 'ioredis';
import { env } from '../config/env';

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5_000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};

const redisConnectionOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: parseInt(env.REDIS_PORT, 10),
  maxRetriesPerRequest: null,
};

export class QueueService {
  private readonly connectionOptions: RedisOptions;

  constructor(connectionOptions: RedisOptions = redisConnectionOptions) {
    this.connectionOptions = connectionOptions;
    console.log(`[queue] Redis configured at ${connectionOptions.host}:${connectionOptions.port}`);
  }

  createQueue<DataType = unknown, ResultType = unknown, NameType extends string = string>(
    name: string,
    options: Omit<QueueOptions, 'connection'> = {},
  ): Queue<DataType, ResultType, NameType> {
    const queue = new Queue<DataType, ResultType, NameType>(name, {
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
      ...options,
      connection: this.connectionOptions,
    });

    queue.on('error', error => {
      console.error(`[queue:${name}] Queue error`, error);
    });

    console.log(`[queue:${name}] Queue registered`);

    return queue;
  }

  registerWorker<DataType = unknown, ResultType = unknown, NameType extends string = string>(
    queueName: string,
    processor: Processor<DataType, ResultType, NameType>,
    options: Omit<WorkerOptions, 'connection'> = {},
  ): Worker<DataType, ResultType, NameType> {
    const worker = new Worker<DataType, ResultType, NameType>(queueName, processor, {
      concurrency: 1,
      ...options,
      connection: this.connectionOptions,
    });

    worker.on('ready', () => {
      console.log(`[worker:${queueName}] Worker ready`);
    });

    worker.on('active', job => {
      console.log(`[worker:${queueName}] Job ${job.id} active (${job.name})`);
    });

    worker.on('completed', job => {
      console.log(`[worker:${queueName}] Job ${job.id} completed (${job.name})`);
    });

    worker.on('failed', (job, error) => {
      console.error(`[worker:${queueName}] Job ${job?.id ?? 'unknown'} failed`, error);
    });

    worker.on('error', error => {
      console.error(`[worker:${queueName}] Worker error`, error);
    });

    console.log(`[worker:${queueName}] Worker registered`);

    return worker;
  }
}

export const queueService = new QueueService();
