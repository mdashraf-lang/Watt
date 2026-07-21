import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { unauthorized } from '../lib/errors';

// Adds req.user from a valid Bearer access token. Use `requireAuth` to enforce.
export interface AuthUser { id: string; role: string; }
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: AuthUser; }
  }
}

export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization ?? '';
  if (h.startsWith('Bearer ')) {
    try {
      const claims = verifyAccessToken(h.slice(7));
      req.user = { id: claims.sub, role: claims.role };
    } catch { /* invalid/expired — leave req.user undefined */ }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}
