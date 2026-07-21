import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { pool } from '../../db/pool';
import { AppError } from '../../lib/errors';
import * as tuya from '../../integrations/tuya';

const router = Router();
router.use(requireAuth);

// Resolve the charger's Tuya device id from a booking (customer path) or a
// listing (host self-charge path), verifying the caller is authorized.
async function resolveDevice(userId: string, bookingId?: string, listingId?: string): Promise<{ deviceId: string; listingId: string }> {
  if (bookingId) {
    const { rows } = await pool.query(
      `select b.listing_id, cl.tuya_device_id, cl.tuya_verified
       from public.bookings b join public.charger_listings cl on cl.id = b.listing_id
       where b.id = $1 and b.user_id = $2`,
      [bookingId, userId],
    );
    const r = rows[0];
    if (!r) throw new AppError(403, 'forbidden', 'Not your booking');
    if (!r.tuya_verified) throw new AppError(400, 'not_verified', 'Charger not verified by admin');
    if (!r.tuya_device_id) throw new AppError(400, 'no_device', 'No device linked');
    return { deviceId: r.tuya_device_id, listingId: r.listing_id };
  }
  if (listingId) {
    const { rows } = await pool.query(
      `select id, tuya_device_id, tuya_verified from public.charger_listings where id = $1 and host_id = $2`,
      [listingId, userId],
    );
    const r = rows[0];
    if (!r) throw new AppError(403, 'forbidden', 'Not your charger');
    if (!r.tuya_verified) throw new AppError(400, 'not_verified', 'Charger not verified by admin');
    if (!r.tuya_device_id) throw new AppError(400, 'no_device', 'No device linked');
    return { deviceId: r.tuya_device_id, listingId: r.id };
  }
  throw new AppError(400, 'bad_request', 'booking_id or listing_id required');
}

const target = z.object({
  booking_id: z.string().uuid().optional(),
  listing_id: z.string().uuid().optional(),
});

// Turn the charger on/off.
router.post('/switch',
  validateBody(target.extend({ action: z.enum(['on', 'off']) })),
  asyncHandler(async (req, res) => {
    if (!tuya.tuyaConfigured()) throw new AppError(503, 'not_configured', 'Device control not configured');
    const { deviceId, listingId } = await resolveDevice(req.user!.id, req.body.booking_id, req.body.listing_id);
    const on = req.body.action === 'on';
    await tuya.setSwitch(deviceId, on);
    await pool.query(`update public.charger_listings set switch_status = $2 where id = $1`, [listingId, on]);
    res.json({ success: true, switch_status: on });
  }),
);

// Read live power / energy.
router.post('/energy',
  validateBody(target),
  asyncHandler(async (req, res) => {
    if (!tuya.tuyaConfigured()) throw new AppError(503, 'not_configured', 'Device control not configured');
    const { deviceId } = await resolveDevice(req.user!.id, req.body.booking_id, req.body.listing_id);
    const e = await tuya.readEnergy(deviceId);
    res.json({ success: true, ...e });
  }),
);

export default router;
