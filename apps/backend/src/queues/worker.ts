import { Prisma } from '@prisma/client';
import { DEAL_EVENTS_QUEUE_NAME, type DealEventJobData, type DealEventJobName, type DealEventJobResult } from './bull.queue';
import { queueService } from './queue.service';
import prisma from '../services/prisma.service';
import { activityService } from '../services/activity.service';
import { dealService } from '../services/deal.service';
import { scoreAndPersist } from '../services/scoring.service';
import { eventStream } from '../sse/event-stream';

let dealEventsWorker: ReturnType<typeof queueService.registerWorker<DealEventJobData, DealEventJobResult, DealEventJobName>> | null = null;

export const registerDealEventsWorker = () => {
  if (dealEventsWorker) {
    return dealEventsWorker;
  }

  dealEventsWorker = queueService.registerWorker<DealEventJobData, DealEventJobResult, DealEventJobName>(
    DEAL_EVENTS_QUEUE_NAME,
    async job => {
      const event = job.data;

      try {
        const processed = await prisma.$transaction(async tx => {
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

          // Fetch all activities for this deal to inform scoring
          const activities = await tx.activity.findMany({
            where: { dealId: event.dealId },
            orderBy: { occurredAt: 'desc' },
          });

          // Score the deal (non-fatal — errors are caught inside scoreAndPersist)
          await scoreAndPersist(tx, updatedDeal, activities);

          console.log(`[worker:${DEAL_EVENTS_QUEUE_NAME}] Event processed`, {
            eventId: event.eventId,
            dealId: event.dealId,
            eventType: event.eventType,
            jobId: job.id,
          });

          return true;
        });

        if (processed) {
          eventStream.broadcastProcessedEvent(event);
        }
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          console.log(`[worker:${DEAL_EVENTS_QUEUE_NAME}] Skipping duplicate event`, {
            eventId: event.eventId,
            jobId: job.id,
          });
          return;
        }

        throw error;
      }
    },
  );

  return dealEventsWorker;
};
