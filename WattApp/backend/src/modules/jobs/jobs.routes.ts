import { Router, Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/error';
import { env } from '../../config/env';
import { pool, query } from '../../db/pool';
import { unauthorized } from '../../lib/errors';
import * as tuya from '../../integrations/tuya';
import { sendPush } from '../../integrations/push';

// Cron endpoints — called on a timer (server crontab / systemd timer) with the
// x-job-secret header. Not part of the public app API.
const router = Router();

function requireJobSecret(req: Request, _res: Response, next: NextFunction) {
  if ((req.headers['x-job-secret'] ?? '') !== env.JOB_SECRET) return next(unauthorized());
  next();
}
router.use(requireJobSecret);

// Every ~1 min: stop sessions whose booking window has ended, bill them, push.
router.post('/auto-shutoff', asyncHandler(async (_req, res) => {
  const { rows: expired } = await query(`select * from public.expired_active_sessions`);
  const results: any[] = [];
  for (const row of expired as any[]) {
    try {
      // Turn off the physical switch if it's on.
      if (row.tuya_device_id && row.switch_status && tuya.tuyaConfigured()) {
        await tuya.setSwitch(row.tuya_device_id, false).catch(() => {});
        await pool.query(`update public.charger_listings set switch_status=false where id=$1`, [row.listing_id]);
      }
      // Estimate kWh up to booking end (prefer synced meter reading).
      const { rows: lr } = await pool.query(`select power_kw from public.charger_listings where id=$1`, [row.listing_id]);
      const power = Number(lr[0]?.power_kw ?? 22);
      const hours = Math.max(0, (new Date(row.booking_ends_at).getTime() - new Date(row.started_at).getTime()) / 3_600_000);
      const est = hours * power;
      const synced = Number(row.kwh_delivered ?? 0);
      const kwh = Math.min(synced > 0 ? synced : est, est * 1.25);

      // Finalize through the shared billing function (releases hold, caps at hold,
      // debits customer, pays host — atomic + idempotent).
      const { rows: fin } = await pool.query(
        `select public._finalize_charging_session($1,$2,$3,$4,$5) as result`,
        [row.session_id, kwh, null, 'Charging session (auto-stop)', row.booking_ends_at],
      );
      const cost = Number(fin[0]?.result?.cost ?? 0);
      await sendPush([row.user_id], 'charging', 'Charging finished',
        `Your charging session ended. Charged ${cost.toFixed(3)} OMR.`).catch(() => {});
      results.push({ session_id: row.session_id, status: 'completed' });
    } catch (e: any) {
      results.push({ session_id: row.session_id, status: 'error', error: e.message });
    }
  }
  res.json({ processed: results.length, results });
}));

// Every ~10 min: release no-show bookings (frees the slot).
router.post('/no-show', asyncHandler(async (_req, res) => {
  const { rows } = await query(`select public.release_no_show_bookings() as count`);
  res.json({ released: rows[0]?.count ?? 0 });
}));

// Daily: disburse due investor payouts (no-op unless enabled + provider set).
router.post('/disburse', asyncHandler(async (_req, res) => {
  const { rows: batch } = await query(`select * from public.enqueue_auto_payouts()`);
  const results: any[] = [];
  for (const row of batch as any[]) {
    // No payout provider wired yet → mark failed (auto-refunds). Wire the real
    // provider call here when available, then settle with ok=true + ref.
    await pool.query(`select public.settle_auto_payout($1,$2,$3,$4)`,
      [row.id, false, null, `No payout provider implemented for '${row.provider}'`]);
    results.push({ id: row.id, status: 'failed' });
  }
  res.json({ processed: results.length, results });
}));

export default router;
