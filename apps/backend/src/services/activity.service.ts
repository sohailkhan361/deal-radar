import { Prisma, type PrismaClient } from '@prisma/client';
import type { DealEventJobData } from '../queues';

type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const getOccurredAt = (event: DealEventJobData) => {
  if (!event.occurredAt) {
    return new Date();
  }

  const occurredAt = new Date(event.occurredAt);
  return Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;
};

export class ActivityService {
  async hasProcessedEvent(tx: TransactionClient, eventId: string) {
    const processedEvent = await tx.processedEvent.findUnique({
      where: {
        eventId,
      },
    });

    return Boolean(processedEvent);
  }

  async saveActivity(tx: TransactionClient, event: DealEventJobData) {
    return tx.activity.create({
      data: {
        eventId: event.eventId,
        dealId: event.dealId,
        eventType: event.eventType,
        payload: event.payload as Prisma.InputJsonValue,
        occurredAt: getOccurredAt(event),
      },
    });
  }

  async storeProcessedEvent(tx: TransactionClient, eventId: string) {
    return tx.processedEvent.create({
      data: {
        eventId,
      },
    });
  }
}

export const activityService = new ActivityService();
