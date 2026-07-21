import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error';
import { requireAuth } from '../../middleware/auth';
import { query, callFn } from '../../db/pool';

const router = Router();

// List stations (public to signed-in users).
router.get('/', requireAuth, asyncHandler(async (_req, res) => {
  const { rows } = await query(`select * from public.stations order by name`);
  res.json(rows);
}));

// Booked slots for availability (station or listing).
// NOTE: declared before '/:id' so "availability" isn't matched as an id.
router.get('/availability', requireAuth, asyncHandler(async (req, res) => {
  const q = z.object({
    from: z.string(), to: z.string(),
    station_id: z.string().uuid().optional(),
    listing_id: z.string().uuid().optional(),
  }).parse(req.query);
  const row = await callFn<{ result: any }>(req.user!.id,
    `select coalesce(json_agg(s), '[]'::json) as result
     from public.get_booked_slots($1,$2,$3,$4) s`,
    [q.from, q.to, q.station_id ?? null, q.listing_id ?? null]);
  res.json(row.result);
}));

// Single station + connectors.
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(`select * from public.stations where id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: { code: 'not_found', message: 'Station not found' } });
  const { rows: connectors } = await query(`select * from public.connectors where station_id = $1`, [req.params.id]);
  res.json({ ...rows[0], connectors });
}));

// Public reviews for a station.
router.get('/:id/reviews', requireAuth, asyncHandler(async (req, res) => {
  const row = await callFn<{ result: any }>(req.user!.id,
    'select coalesce(json_agg(r), \'[]\'::json) as result from public.get_charger_reviews($1, null) r',
    [req.params.id]);
  res.json(row.result);
}));

export default router;
