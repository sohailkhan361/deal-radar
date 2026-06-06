import { Prisma } from '@prisma/client';
import type { Worker } from 'bullmq';
import {
  DEAL_EVENTS_QUEUE_NAME,
  type DealEventJobData,
  type DealEventJobName,
  type DealEventJobResult,
} from './bull.queue';
import { queueService } from './queue.service';
import prisma from '../services/prisma.service';
import { activityService } from '../services/activity.service';
import { dealService } from '../services/deal.service';
import { scoreAndPersist } from '../services/scoring.service';
import { eventStream } from '../sse/event-stream';

// ---------------------------------------------------------------------------
// Singleton — one worker per process
// ---------------------------------------------------------------------------

let dealEventsWorker: Worker<DealEventJobData, DealEventJobResult, DealEventJobName> | null = null;

export const registerDealEventsWorker = (): Worker<
  DealEventJobData,
  DealEventJobResult,
  DealEventJobName
> => {
  if (dealEventsWorker) {
    return dealEventsWorker;
  }

  dealEventsWorker = queueService.registerWorker<
    DealEventJobData,
    DealEventJobResult,
    DealEventJobName
  >(DEAL_EVENTS_QUEUE_NAME, async job => {
    const event = job.data;

    try {
      const processed = await prisma.$transaction(async tx => {
        // Idempotency guard
        const alreadyProcessed = await activityService.hasProcessedEvent(tx, event.eventId);
        if (alreadyProcessed) {
          console.log(`[worker:${DEAL_EVENTS_QUEUE_NAME}] Skipping duplicate event`, {
            eventId: event.eventId,
            jobId: job.id,
          });
          return false;
        }

        await dealService.ensureDeal(tx, event);
        await activityService.saveActivity(tx, event);
        const updatedDeal = await dealService.applyEvent(tx, event);
        await activityService.storeProcessedEvent(tx, event.eventId);

        // Fetch all activities for full scoring context
        const activities = await tx.activity.findMany({
          where: { dealId: event.dealId },
          orderBy: { occurredAt: 'desc' },
        });

        // Non-fatal — errors are caught inside scoreAndPersist
        await scoreAndPersist(tx, updatedDeal, activities);

        console.log(`[worker:${DEAL_EVENTS_QUEUE_NAME}] Event processed`, {
          eventId: event.eventId,
          dealId: event.dealId,
          eventType: event.eventType,
          jobId: job.id,
        });

        return true;
      });

      // Broadcast outside the transaction — only after a clean commit
      if (processed) {
        eventStream.broadcastProcessedEvent(event);
      }
    } catch (error) {
      // P2002 = unique constraint — duplicate reached the DB despite idempotency check
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        console.log(`[worker:${DEAL_EVENTS_QUEUE_NAME}] Skipping duplicate (race condition)`, {
          eventId: event.eventId,
          jobId: job.id,
        });
        return;
      }
      // Re-throw so BullMQ can retry according to the job options
      throw error;
    }
  });

  return dealEventsWorker;
};

/**
 * Gracefully close the worker.
 * Called from the SIGTERM/SIGINT handler in src/index.ts.
 * Waits for the active job (if any) to finish before resolving.
 */
export const closeDealEventsWorker = async (): Promise<void> => {
  if (dealEventsWorker) {
    await dealEventsWorker.close();
    dealEventsWorker = null;
    console.log(`[worker:${DEAL_EVENTS_QUEUE_NAME}] Worker closed`);
  }
};
