import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

// ---------------------------------------------------------------------------
// Typed application error
// Throw this from controllers/services when you want a specific HTTP status.
// ---------------------------------------------------------------------------

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
    // Restore prototype chain in compiled JS
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Global Express error handler
// Must be the last middleware registered (4 parameters).
// ---------------------------------------------------------------------------

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // Express requires the 4th param even when unused
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  const message =
    err instanceof Error ? err.message : 'Internal Server Error';
  const statusCode =
    err instanceof AppError ? err.statusCode : 500;
  const stack =
    err instanceof Error ? err.stack : undefined;

  if (statusCode >= 500) {
    console.error('[error] Unhandled server error', { statusCode, message, stack });
  } else {
    console.warn('[error] Client error', { statusCode, message });
  }

  res.status(statusCode).json({
    error: {
      message,
      // Only expose stack traces in development
      ...(env.NODE_ENV === 'development' && stack ? { stack } : {}),
    },
  });
};
