import { type Request, type Response } from 'express';
import type { DealEventJobData } from '../queues';

type SseClient = {
  id: string;
  response: Response;
};

type ProcessedEventPayload = {
  eventId: string;
  dealId: string;
  eventType: DealEventJobData['eventType'];
  processedAt: string;
};

const HEARTBEAT_INTERVAL_MS = 30_000;

class EventStream {
  private readonly clients = new Map<string, SseClient>();
  private readonly heartbeatTimer: NodeJS.Timeout;

  constructor() {
    this.heartbeatTimer = setInterval(() => {
      this.broadcast('heartbeat', { timestamp: new Date().toISOString() });
    }, HEARTBEAT_INTERVAL_MS);

    this.heartbeatTimer.unref();
  }

  addClient(req: Request, res: Response) {
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    this.clients.set(clientId, {
      id: clientId,
      response: res,
    });

    console.log('[sse] Client connected', {
      clientId,
      activeClients: this.clients.size,
    });

    this.send(res, 'connected', {
      clientId,
      activeClients: this.clients.size,
    });

    req.on('close', () => {
      this.removeClient(clientId);
    });
  }

  broadcastProcessedEvent(event: DealEventJobData) {
    const payload: ProcessedEventPayload = {
      eventId: event.eventId,
      dealId: event.dealId,
      eventType: event.eventType,
      processedAt: new Date().toISOString(),
    };

    this.broadcast('deal-event-processed', payload);
  }

  broadcast(eventName: string, data: unknown) {
    for (const client of this.clients.values()) {
      this.send(client.response, eventName, data);
    }
  }

  private removeClient(clientId: string) {
    const deleted = this.clients.delete(clientId);

    if (deleted) {
      console.log('[sse] Client disconnected', {
        clientId,
        activeClients: this.clients.size,
      });
    }
  }

  private send(res: Response, eventName: string, data: unknown) {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

export const eventStream = new EventStream();
