import type { Request, Response } from 'express';
import type { DealEventType } from '@deal-radar/shared-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SseClient = {
  id: string;
  response: Response;
};

type ProcessedEventPayload = {
  eventId: string;
  dealId: string;
  eventType: DealEventType;
  processedAt: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEARTBEAT_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// EventStream
// ---------------------------------------------------------------------------

class EventStream {
  private readonly clients = new Map<string, SseClient>();
  private readonly heartbeatTimer: NodeJS.Timeout;

  constructor() {
    this.heartbeatTimer = setInterval(() => {
      this.broadcast('heartbeat', { timestamp: new Date().toISOString() });
    }, HEARTBEAT_INTERVAL_MS);

    // Don't keep the process alive just for heartbeats
    this.heartbeatTimer.unref();
  }

  addClient(req: Request, res: Response): void {
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Disable nginx proxy buffering — events must arrive immediately
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    this.clients.set(clientId, { id: clientId, response: res });

    console.log('[sse] Client connected', { clientId, activeClients: this.clients.size });

    // Send initial event so the client knows it's live
    this.send(clientId, res, 'connected', {
      clientId,
      activeClients: this.clients.size,
    });

    req.on('close', () => this.removeClient(clientId));
  }

  broadcastProcessedEvent(event: {
    eventId: string;
    dealId: string;
    eventType: DealEventType;
  }): void {
    const payload: ProcessedEventPayload = {
      eventId: event.eventId,
      dealId: event.dealId,
      eventType: event.eventType,
      processedAt: new Date().toISOString(),
    };
    this.broadcast('deal-event-processed', payload);
  }

  broadcast(eventName: string, data: unknown): void {
    for (const client of this.clients.values()) {
      this.send(client.id, client.response, eventName, data);
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private removeClient(clientId: string): void {
    if (this.clients.delete(clientId)) {
      console.log('[sse] Client disconnected', { clientId, activeClients: this.clients.size });
    }
  }

  /**
   * Write a single SSE event frame.
   * Silently removes the client on EPIPE / write-after-close — this is normal
   * when a browser navigates away before the close event fires.
   */
  private send(clientId: string, res: Response, eventName: string, data: unknown): void {
    try {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.warn('[sse] Write failed — removing client', {
        clientId,
        error: err instanceof Error ? err.message : String(err),
      });
      this.removeClient(clientId);
    }
  }
}

export const eventStream = new EventStream();
