import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { validateBody } from '../../middleware/validate';
import { query, callFn } from '../../db/pool';

const router = Router();
const requireHost = requireRole('host', 'investor');

// The host's own charger listing.
router.get('/listing', requireAuth, requireHost, asyncHandler(async (req, res) => {
  const { rows } = await query(`select * from public.charger_listings where host_id = $1`, [req.user!.id]);
  res.json(rows[0] ?? null);
}));

// Bookings on the host's charger (function returns customer name/phone safely).
router.get('/bookings', requireAuth, requireHost, asyncHandler(async (req, res) => {
  const row = await callFn<{ result: any }>(req.user!.id,
    `select coalesce(json_agg(b), '[]'::json) as result from public.get_host_listing_bookings() b`);
  res.json(row.result);
}));

// Toggle listing availability (a pure flag — never powers the plug; scoped to owner).
router.patch('/listing/availability',
  requireAuth, requireHost,
  validateBody(z.object({ is_available: z.boolean() })),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `update public.charger_listings set is_available = $2 where host_id = $1 returning id, is_available`,
      [req.user!.id, req.body.is_available],
    );
    if (!rows[0]) return res.status(404).json({ error: { code: 'not_found', message: 'No listing' } });
    res.json(rows[0]);
  }),
);

// Edit listing details the host is allowed to change (price is admin-controlled;
// device id locks after verification — enforced by DB triggers + this allowlist).
router.patch('/listing',
  requireAuth, requireHost,
  validateBody(z.object({
    address: z.string().optional(),
    power_kw: z.number().positive().optional(),
    availability_start: z.string().optional(),
    availability_end: z.string().optional(),
    description: z.string().nullable().optional(),
    tuya_device_id: z.string().nullable().optional(),
  }).strict()),
  asyncHandler(async (req, res) => {
    const body = { ...req.body };
    // Device-ID lock (Phase 3): once the charger is admin-verified, the host may
    // NOT change tuya_device_id. Enforced here since the DB trigger doesn't fire
    // for the backend's connection role.
    if ('tuya_device_id' in body) {
      const { rows } = await query(
        `select tuya_verified from public.charger_listings where host_id = $1`, [req.user!.id]);
      if (rows[0]?.tuya_verified) delete body.tuya_device_id;   // silently keep locked value
    }
    const keys = Object.keys(body);
    if (!keys.length) return res.status(400).json({ error: { code: 'bad_request', message: 'No changeable fields' } });
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const vals = keys.map(k => (body as any)[k]);
    const { rows } = await query(
      `update public.charger_listings set ${sets} where host_id = $1 returning *`, [req.user!.id, ...vals]);
    res.json(rows[0]);
  }),
);

export default router;
