import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireRole';
import { validateBody } from '../../middleware/validate';
import { query, callFn } from '../../db/pool';

const router = Router();
router.use(requireAuth, requireAdmin);

// Network analytics (revenue/sessions/kWh + top chargers + flagged count).
router.get('/analytics', asyncHandler(async (req, res) => {
  const row = await callFn<{ result: any }>(req.user!.id, 'select public.get_admin_analytics() as result');
  res.json(row.result);
}));

// Flagged (meter-mismatch) sessions for review.
router.get('/flagged', asyncHandler(async (req, res) => {
  const row = await callFn<{ result: any }>(req.user!.id,
    `select coalesce(json_agg(f), '[]'::json) as result from public.get_flagged_sessions_detail() f`);
  res.json(row.result);
}));

// Clear a flag after review.
router.post('/flagged/:id/resolve', asyncHandler(async (req, res) => {
  await callFn(req.user!.id, 'select public.resolve_flagged_session($1)', [req.params.id]);
  res.status(204).end();
}));

// Users list (admins can read across users; email joined from auth.users).
router.get('/users', asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `select p.id, p.full_name, p.phone, p.role, p.is_active, p.wallet_balance,
            p.total_sessions, p.total_kwh, u.email, p.created_at
     from public.profiles p join auth.users u on u.id = p.id
     order by p.created_at desc limit 500`,
  );
  res.json(rows);
}));

// Investor applications review actions.
router.post('/applications/:id/:action',
  validateBody(z.object({}).optional()),
  asyncHandler(async (req, res) => {
    const map: Record<string, string> = {
      accept: 'accept_investor_application',
      reject: 'reject_investor_application',
      review: 'set_application_under_review',
    };
    const fn = map[req.params.action];
    if (!fn) return res.status(400).json({ error: { code: 'bad_request', message: 'Unknown action' } });
    const row = await callFn<{ result: any }>(req.user!.id, `select public.${fn}($1) as result`, [req.params.id]);
    res.json(row.result ?? { ok: true });
  }),
);

export default router;
