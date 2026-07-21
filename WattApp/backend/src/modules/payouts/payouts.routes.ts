import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireRole';
import { validateBody } from '../../middleware/validate';
import { query, callFn } from '../../db/pool';

const router = Router();

// Investor requests a payout (🔴 money — SQL function holds the funds atomically).
router.post('/request',
  requireAuth,
  validateBody(z.object({ amount: z.number().positive() })),
  asyncHandler(async (req, res) => {
    const row = await callFn<{ result: any }>(req.user!.id,
      'select public.request_payout($1) as result', [req.body.amount]);
    res.json(row.result);
  }),
);

// Investor's own payout history.
router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select * from public.payout_requests where user_id = $1 order by requested_at desc limit 50`,
    [req.user!.id],
  );
  res.json(rows);
}));

// Admin: list payout requests (function guards admin internally too).
router.get('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  const row = await callFn<{ result: any }>(req.user!.id,
    `select coalesce(json_agg(p), '[]'::json) as result from public.get_payout_requests($1) p`,
    [status]);
  res.json(row.result);
}));

// Admin: mark a payout paid / rejected (🔴 money — refunds on reject).
router.post('/:id/process',
  requireAuth, requireAdmin,
  validateBody(z.object({ action: z.enum(['paid', 'reject']), note: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const row = await callFn<{ result: any }>(req.user!.id,
      'select public.process_payout($1,$2,$3) as result',
      [req.params.id, req.body.action, req.body.note ?? null]);
    res.json(row.result);
  }),
);

export default router;
