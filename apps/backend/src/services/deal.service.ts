import { Prisma, type PrismaClient } from '@prisma/client';
import type { DealEventJobData } from '../queues';

type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const getStringValue = (payload: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
};

const getDecimalValue = (payload: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === 'number' || typeof value === 'string') {
      let decimal: Prisma.Decimal;

      try {
        decimal = new Prisma.Decimal(value);
      } catch {
        continue;
      }

      if (!decimal.isNaN()) {
        return decimal;
      }
    }
  }

  return undefined;
};

const getDateValue = (payload: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value !== 'string') {
      continue;
    }

    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return undefined;
};

const getOccurredAt = (event: DealEventJobData) => {
  if (!event.occurredAt) {
    return new Date();
  }

  const occurredAt = new Date(event.occurredAt);
  return Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;
};

const getStageForEvent = (event: DealEventJobData) => {
  const payloadStage = getStringValue(event.payload, ['stage', 'newStage', 'new_stage', 'status']);

  if (payloadStage) {
    return payloadStage;
  }

  if (event.eventType === 'deal_closed') {
    return 'CLOSED';
  }

  return 'UNKNOWN';
};

const buildDealUpdate = (event: DealEventJobData): Prisma.DealUpdateInput => {
  const data: Prisma.DealUpdateInput = {
    updatedAt: new Date(),
  };

  const amount = getDecimalValue(event.payload, ['amount', 'dealAmount', 'deal_amount']);
  const closeDate = getDateValue(event.payload, ['closeDate', 'close_date']);

  if (amount) {
    data.amount = amount;
  }

  if (closeDate) {
    data.closeDate = closeDate;
  }

  if (event.eventType === 'stage_changed' || event.eventType === 'deal_closed') {
    data.stage = getStageForEvent(event);
  }

  return data;
};

export class DealService {
  async ensureDeal(tx: TransactionClient, event: DealEventJobData) {
    const amount = getDecimalValue(event.payload, ['amount', 'dealAmount', 'deal_amount']) ?? new Prisma.Decimal(0);
    const closeDate = getDateValue(event.payload, ['closeDate', 'close_date']) ?? getOccurredAt(event);

    return tx.deal.upsert({
      where: {
        dealId: event.dealId,
      },
      create: {
        dealId: event.dealId,
        stage: getStageForEvent(event),
        amount,
        closeDate,
      },
      update: {},
    });
  }

  async applyEvent(tx: TransactionClient, event: DealEventJobData) {
    return tx.deal.update({
      where: {
        dealId: event.dealId,
      },
      data: buildDealUpdate(event),
    });
  }
}

export const dealService = new DealService();
