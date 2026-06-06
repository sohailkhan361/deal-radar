import { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { dealEventsQueue } from '../queues';

const supportedDealEventTypes = ['stage_changed', 'email_sent', 'meeting_booked', 'note_added', 'deal_closed'] as const;

const rawDealEventSchema = z.object({
  eventId: z.string().min(1).optional(),
  event_id: z.string().min(1).optional(),
  dealId: z.string().min(1).optional(),
  deal_id: z.string().min(1).optional(),
  eventType: z.enum(supportedDealEventTypes).optional(),
  event_type: z.enum(supportedDealEventTypes).optional(),
  payload: z.record(z.string(), z.unknown()),
  occurredAt: z.string().datetime().optional(),
  occurred_at: z.string().datetime().optional(),
});

const dealEventSchema = rawDealEventSchema
  .superRefine((event, ctx) => {
    if (!event.eventId && !event.event_id) {
      ctx.addIssue({
        code: 'custom',
        message: 'eventId or event_id is required',
        path: ['eventId'],
      });
    }

    if (!event.dealId && !event.deal_id) {
      ctx.addIssue({
        code: 'custom',
        message: 'dealId or deal_id is required',
        path: ['dealId'],
      });
    }

    if (!event.eventType && !event.event_type) {
      ctx.addIssue({
        code: 'custom',
        message: 'eventType or event_type is required',
        path: ['eventType'],
      });
    }
  })
  .transform(event => ({
    eventId: (event.eventId ?? event.event_id) as string,
    dealId: (event.dealId ?? event.deal_id) as string,
    eventType: (event.eventType ?? event.event_type) as (typeof supportedDealEventTypes)[number],
    payload: event.payload,
    occurredAt: event.occurredAt ?? event.occurred_at,
  }));

export const ingestWebhook = async (req: Request, res: Response, next: NextFunction) => {
  console.log('[webhook] Incoming deal event request', {
    method: req.method,
    path: req.originalUrl,
    eventId: req.body?.eventId ?? req.body?.event_id,
    dealId: req.body?.dealId ?? req.body?.deal_id,
    eventType: req.body?.eventType ?? req.body?.event_type,
  });

  const parsedPayload = dealEventSchema.safeParse(req.body);

  if (!parsedPayload.success) {
    console.warn('[webhook] Invalid deal event payload', parsedPayload.error.flatten());

    res.status(400).json({
      error: {
        message: 'Invalid deal event payload',
        details: parsedPayload.error.flatten(),
      },
    });
    return;
  }

  try {
    const job = await dealEventsQueue.add('deal-event-received', parsedPayload.data, {
      jobId: parsedPayload.data.eventId,
    });

    console.log('[webhook] Deal event enqueued', {
      jobId: job.id,
      eventId: parsedPayload.data.eventId,
      dealId: parsedPayload.data.dealId,
      eventType: parsedPayload.data.eventType,
    });

    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
};
