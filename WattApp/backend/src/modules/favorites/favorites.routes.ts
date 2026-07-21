import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { query } from '../../db/pool';

const router = Router();

// List the user's favorites (with basic charger info).
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select f.id, f.station_id, f.listing_id, f.created_at,
            s.name as station_name, cl.station_name as listing_name, cl.address as listing_address
     from public.favorites f
     left join public.stations s on s.id = f.station_id
     left join public.charger_listings cl on cl.id = f.listing_id
     where f.user_id = $1 order by f.created_at desc`,
    [req.user!.id],
  );
  res.json(rows);
}));

// Add a favorite (station or listing). Duplicate → 409 via error handler.
router.post('/',
  requireAuth,
  validateBody(z.object({
    station_id: z.string().uuid().nullable().optional(),
    listing_id: z.string().uuid().nullable().optional(),
  }).refine(v => !!v.station_id !== !!v.listing_id, { message: 'Provide exactly one of station_id / listing_id' })),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `insert into public.favorites (user_id, station_id, listing_id) values ($1,$2,$3) returning *`,
      [req.user!.id, req.body.station_id ?? null, req.body.listing_id ?? null],
    );
    res.status(201).json(rows[0]);
  }),
);

// Remove a favorite by row id (must be the user's own).
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  await query(`delete from public.favorites where id = $1 and user_id = $2`, [req.params.id, req.user!.id]);
  res.status(204).end();
}));

export default router;
