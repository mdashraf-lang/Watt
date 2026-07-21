import { Router } from 'express';
import { asyncHandler } from '../../middleware/error';
import { requireAuth } from '../../middleware/auth';
import { query } from '../../db/pool';

const router = Router();

// The current user's wallet transaction history (scoped by token id).
router.get('/transactions', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select * from public.wallet_transactions
     where user_id = $1 order by created_at desc limit 100`,
    [req.user!.id],
  );
  res.json(rows);
}));

export default router;
