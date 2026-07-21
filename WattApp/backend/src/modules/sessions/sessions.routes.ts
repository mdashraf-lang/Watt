import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error';
import { validateBody } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { callFn } from '../../db/pool';

// 🔴 MONEY-CRITICAL. These call the existing hardened SQL functions (with the
// user context set via withUser/callFn), preserving idempotency, row-locking,
// hold/billing correctness, and host payout. Do NOT reimplement this logic here.
const router = Router();

// Start charging: verifies funds, places the hold, creates the session.
router.post('/start',
  requireAuth,
  validateBody(z.object({ booking_id: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    const row = await callFn<{ result: any }>(
      req.user!.id,
      'select public.start_charging_session($1) as result',
      [req.body.booking_id],
    );
    res.json(row.result);
  }),
);

// Complete charging: bills (capped at the hold), releases hold, pays host,
// reconciles the meter reading.
router.post('/:id/complete',
  requireAuth,
  validateBody(z.object({
    kwh: z.number().nonnegative(),
    battery_end: z.number().int().min(0).max(100).nullable().optional(),
    description: z.string().optional(),
    meter_kwh: z.number().nonnegative().nullable().optional(),
  })),
  asyncHandler(async (req, res) => {
    const { kwh, battery_end, description, meter_kwh } = req.body;
    const row = await callFn<{ result: any }>(
      req.user!.id,
      'select public.complete_charging_session($1,$2,$3,$4,$5) as result',
      [req.params.id, kwh, battery_end ?? null, description ?? null, meter_kwh ?? null],
    );
    res.json(row.result);
  }),
);

// Rate a completed session.
router.post('/:id/rate',
  requireAuth,
  validateBody(z.object({ rating: z.number().int().min(1).max(5), comment: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const row = await callFn<{ result: any }>(
      req.user!.id,
      'select public.rate_session($1,$2,$3) as result',
      [req.params.id, req.body.rating, req.body.comment ?? null],
    );
    res.json(row.result);
  }),
);

export default router;
