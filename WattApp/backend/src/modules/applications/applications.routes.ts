import { Router } from 'express';
import { asyncHandler } from '../../middleware/error';
import { requireAuth } from '../../middleware/auth';
import { query } from '../../db/pool';

// Investor / charger applications submitted by the user.
const router = Router();
router.use(requireAuth);

// The user's latest charger application (for the profile status card).
router.get('/mine', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select * from public.charger_applications where user_id = $1
     order by created_at desc limit 1`,
    [req.user!.id],
  );
  res.json(rows[0] ?? null);
}));

// (Submission endpoint added when the investor-application screen is converted.)

export default router;
