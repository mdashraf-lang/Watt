import { Request, Response, NextFunction } from 'express';
import { AppError, fromPgError } from '../lib/errors';

// Wrap async route handlers so thrown errors reach the error middleware.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  let e: AppError = err instanceof AppError ? err : fromPgError(err);
  if (!(err instanceof AppError) && !err?.code && err?.name !== 'AppError') {
    // Unknown non-pg error
    e = e.status ? e : new AppError(500, 'server_error', 'Internal server error');
  }
  if (e.status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }
  res.status(e.status).json({ error: { code: e.code, message: e.message } });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
}
