import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error';
import { validateBody } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import * as svc from './auth.service';
// import { sendEmail } from '../../integrations/email';  // wire when SMTP ready

const router = Router();

const emailPw = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post('/register',
  validateBody(emailPw.extend({ full_name: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const { email, password, full_name } = req.body;
    res.status(201).json(await svc.register(email, password, full_name));
  }),
);

router.post('/login', validateBody(emailPw), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  res.json(await svc.login(email, password));
}));

router.post('/refresh',
  validateBody(z.object({ refresh_token: z.string().min(1) })),
  asyncHandler(async (req, res) => res.json(await svc.refresh(req.body.refresh_token))),
);

router.post('/logout',
  validateBody(z.object({ refresh_token: z.string().optional() })),
  asyncHandler(async (req, res) => { await svc.logout(req.body.refresh_token ?? ''); res.status(204).end(); }),
);

router.post('/change-password',
  requireAuth,
  validateBody(z.object({ current_password: z.string(), new_password: z.string().min(8) })),
  asyncHandler(async (req, res) => {
    await svc.changePassword(req.user!.id, req.body.current_password, req.body.new_password);
    res.status(204).end();
  }),
);

router.post('/forgot-password',
  validateBody(z.object({ email: z.string().email() })),
  asyncHandler(async (req, res) => {
    const token = await svc.requestPasswordReset(req.body.email);
    // TODO: email the link, e.g. https://gowatt.om/reset?token=<token>
    // if (token) await sendEmail(req.body.email, 'Reset your password', `token: ${token}`);
    void token;
    res.json({ ok: true }); // always ok — don't reveal whether the email exists
  }),
);

router.post('/reset-password',
  validateBody(z.object({ token: z.string(), new_password: z.string().min(8) })),
  asyncHandler(async (req, res) => {
    await svc.resetPassword(req.body.token, req.body.new_password);
    res.status(204).end();
  }),
);

router.post('/check-email',
  validateBody(z.object({ email: z.string().email() })),
  asyncHandler(async (req, res) => res.json({ exists: await svc.emailExists(req.body.email) })),
);

export default router;
