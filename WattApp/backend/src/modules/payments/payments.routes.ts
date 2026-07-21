import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { pool, callFn } from '../../db/pool';
import { AppError } from '../../lib/errors';
import * as thawani from '../../integrations/thawani';

const router = Router();
router.use(requireAuth);

// Create a Thawani checkout session for a wallet top-up.
router.post('/create',
  validateBody(z.object({ amount: z.number() })),
  asyncHandler(async (req, res) => {
    if (!thawani.thawaniConfigured()) throw new AppError(503, 'not_configured', 'Payments not configured');
    const err = thawani.validateAmount(req.body.amount);
    if (err) throw new AppError(400, 'bad_request', err);

    const created = await thawani.createCheckout(req.user!.id, req.body.amount);
    await pool.query(
      `insert into public.payment_sessions (user_id, session_id, amount, status) values ($1,$2,$3,'pending')`,
      [req.user!.id, created.session_id, req.body.amount],
    );
    res.json({ success: true, ...created });
  }),
);

// Verify a session; if paid, credit the wallet (idempotent via the SQL function).
router.post('/verify',
  validateBody(z.object({ session_id: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `select user_id, amount, status from public.payment_sessions where session_id = $1`,
      [req.body.session_id],
    );
    const ps = rows[0];
    if (!ps || ps.user_id !== req.user!.id) throw new AppError(404, 'not_found', 'Session not found');
    if (ps.status === 'paid') return res.json({ success: true, status: 'paid', already: true });

    const status = await thawani.getPaymentStatus(req.body.session_id);
    if (status === 'paid') {
      const row = await callFn<{ balance: number }>(req.user!.id,
        'select public.credit_wallet_topup($1,$2,$3,$4) as balance',
        [req.user!.id, ps.amount, req.body.session_id, 'thawani']);
      return res.json({ success: true, status: 'paid', balance: row.balance });
    }
    if (status === 'cancelled' || status === 'expired') {
      await pool.query(`update public.payment_sessions set status='failed' where session_id=$1`, [req.body.session_id]);
    }
    res.json({ success: true, status: status ?? 'pending' });
  }),
);

export default router;
