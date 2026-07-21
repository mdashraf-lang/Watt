import { Request, Response, NextFunction } from 'express';
import { forbidden, unauthorized } from '../lib/errors';

// Role guards. Admin endpoints accept admin OR superadmin (mirrors is_admin()).
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

export const requireAdmin      = requireRole('admin', 'superadmin');
export const requireSuperadmin = requireRole('superadmin');
