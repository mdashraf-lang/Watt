import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { query, callFn } from '../../db/pool';

const router = Router();

// List the current user's bookings (+ station name for display).
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select b.*, json_build_object('name', s.name, 'name_ar', s.name_ar,
              'governorate', s.governorate) as station
     from public.bookings b
     left join public.stations s on s.id = b.station_id
     where b.user_id = $1
     order by b.booked_at desc`,
    [req.user!.id],
  );
  res.json(rows);
}));

// Create a booking. user_id is ALWAYS taken from the token, never the client.
// The DB exclusion constraint rejects overlaps (mapped to 409 by error handler).
router.post('/',
  requireAuth,
  validateBody(z.object({
    station_id: z.string().uuid().nullable().optional(),
    listing_id: z.string().uuid().nullable().optional(),
    booked_at: z.string(),
    duration_minutes: z.number().int().min(15).max(720),
    estimated_kwh: z.number().nonnegative().optional(),
    estimated_cost: z.number().nonnegative().optional(),
  })),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `insert into public.bookings
         (user_id, station_id, listing_id, status, booked_at, duration_minutes, estimated_kwh, estimated_cost)
       values ($1,$2,$3,'confirmed',$4,$5,$6,$7) returning *`,
      [req.user!.id, b.station_id ?? null, b.listing_id ?? null, b.booked_at,
       b.duration_minutes, b.estimated_kwh ?? null, b.estimated_cost ?? null],
    );
    res.status(201).json(rows[0]);
  }),
);

// Cancel own booking (only while still cancellable).
router.post('/:id/cancel',
  requireAuth,
  validateBody(z.object({ reason: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `update public.bookings
         set status = 'cancelled', cancellation_reason = $3
       where id = $1 and user_id = $2 and status in ('pending','confirmed')
       returning *`,
      [req.params.id, req.user!.id, req.body.reason ?? null],
    );
    if (!rows[0]) return res.status(409).json({ error: { code: 'conflict', message: 'Cannot cancel this booking' } });
    res.json(rows[0]);
  }),
);

// Whether a charger currently has an active session (for the UI).
router.get('/:listingId/active', requireAuth, asyncHandler(async (req, res) => {
  const row = await callFn<{ result: boolean }>(req.user!.id,
    'select public.listing_has_active_session($1) as result', [req.params.listingId]);
  res.json({ active: row.result });
}));

export default router;
