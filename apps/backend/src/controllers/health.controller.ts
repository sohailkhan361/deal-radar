import type { Request, Response } from 'express';
import prisma from '../services/prisma.service';

type ServiceStatus = 'ok' | 'error';

export const getHealth = async (_req: Request, res: Response): Promise<void> => {
  let dbStatus: ServiceStatus = 'ok';

  try {
    // Lightweight ping — no table scan
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = 'error';
    console.error('[health] Database connectivity check failed', err);
  }

  const overall = dbStatus === 'ok' ? 'ok' : 'degraded';

  res.status(overall === 'ok' ? 200 : 503).json({
    status: overall,
    timestamp: new Date().toISOString(),
    services: { database: dbStatus },
  });
};
