import 'dotenv/config';
import { z } from 'zod';

// Validate environment once at startup — fail fast if anything is missing.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),

  CORS_ORIGIN: z.string().default('*'),

  // Public base URL of this backend (used to build payment return/redirect links
  // that hosted checkouts like Thawani require to be valid http(s) URLs).
  PUBLIC_URL: z.string().default('https://go-watt.com'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('no-reply@gowatt.om'),

  THAWANI_BASE_URL: z.string().default('https://checkout.thawani.om'),
  THAWANI_SECRET_KEY: z.string().optional(),
  THAWANI_PUBLISHABLE_KEY: z.string().optional(),
  TUYA_BASE_URL: z.string().default('https://openapi.tuyaeu.com'),
  TUYA_CLIENT_ID: z.string().optional(),
  TUYA_CLIENT_SECRET: z.string().optional(),

  JOB_SECRET: z.string().min(8).default('change-me'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
