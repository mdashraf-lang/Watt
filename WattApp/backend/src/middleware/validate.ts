import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { badRequest } from '../lib/errors';

// Validate req.body / params / query against a zod schema; replaces the value
// with the parsed (typed) result.
export const validateBody = (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.body);
    if (!r.success) return next(badRequest(r.error.issues.map(i => i.message).join(', ')));
    req.body = r.data;
    next();
  };

export const validateQuery = (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.query);
    if (!r.success) return next(badRequest(r.error.issues.map(i => i.message).join(', ')));
    (req as any).validatedQuery = r.data;
    next();
  };
