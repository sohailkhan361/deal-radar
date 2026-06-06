import { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { dealEventsQueue } from '../queues';

const dealEventSchema = z.object({
  eventId: z.string().min(1),
  dealId: z.string().min(1),
  eventType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  occurredAt: z.string().datetime().optional(),
});

export const ingestWebhook = async (req: Request, res: Response, next: NextFunction) => {
  console.log('[webhook] Incoming deal event request', {
    method: req.method,
    path: req.originalUrl,
    eventId: req.body?.eventId,
    dealId: req.body?.dealId,
    eventType: req.body?.eventType,
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
