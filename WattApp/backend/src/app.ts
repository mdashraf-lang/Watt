import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { attachUser } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';

import authRoutes from './modules/auth/auth.routes';
import profileRoutes from './modules/profile/profile.routes';
import stationsRoutes from './modules/stations/stations.routes';
import sessionsRoutes from './modules/sessions/sessions.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(attachUser);

  app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  // Stricter rate limit on auth endpoints.
  const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 50, standardHeaders: true, legacyHeaders: false });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/stations', stationsRoutes);
  app.use('/api/sessions', sessionsRoutes);
  // TODO (same pattern): /api/bookings, /api/wallet, /api/favorites,
  //   /api/payouts, /api/admin, /api/superadmin, /api/devices, /api/payments

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
