import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error';
import { requireAuth } from '../../middleware/auth';
import { requireSuperadmin } from '../../middleware/requireRole';
import { validateBody } from '../../middleware/validate';
import { callFn } from '../../db/pool';

const router = Router();
router.use(requireAuth, requireSuperadmin);

// List admins + superadmins.
router.get('/admins', asyncHandler(async (req, res) => {
  const row = await callFn<{ result: any }>(req.user!.id,
    `select coalesce(json_agg(a), '[]'::json) as result from public.sa_list_admins() a`);
  res.json(row.result);
}));

// Promote/remove an admin by email or phone.
router.post('/admins',
  validateBody(z.object({ identifier: z.string().min(1), make: z.boolean() })),
  asyncHandler(async (req, res) => {
    const row = await callFn<{ result: any }>(req.user!.id,
      'select public.sa_set_admin($1,$2) as result', [req.body.identifier, req.body.make]);
    res.json(row.result);
  }),
);

// Platform settings.
router.get('/settings', asyncHandler(async (req, res) => {
  const row = await callFn<{ result: any }>(req.user!.id, 'select public.sa_get_settings() as result');
  res.json(row.result);
}));

router.put('/settings',
  validateBody(z.object({ key: z.string().min(1), value: z.string() })),
  asyncHandler(async (req, res) => {
    await callFn(req.user!.id, 'select public.sa_set_setting($1,$2)', [req.body.key, req.body.value]);
    res.status(204).end();
  }),
);

export default router;
