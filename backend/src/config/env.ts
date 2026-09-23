import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment configuration, validated at startup.
 * The app refuses to boot with an invalid configuration (fail-fast):
 * a misconfigured secret discovered at runtime is far more expensive.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  PASSWORD_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'PASSWORD_ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),

  // --- Email (credentials delivery). All optional: without SMTP config the
  //     mailer runs in dev mode (logs the message instead of sending). ---
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Gestión Logística <no-reply@empresa.com>'),
  /** Login URL included in the credentials email. */
  APP_URL: z.string().url().default('http://localhost:5173'),

  /**
   * Number of reverse proxies between the client and this process (Express
   * "trust proxy" hop count). 0 = none (local dev). Behind proxies it must
   * match the real chain, or req.ip becomes the proxy's address and the
   * login rate limiter throttles everyone as a single client. Too high lets
   * a client spoof its IP through X-Forwarded-For. See README (deploy).
   */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

  /**
   * Time of day of the automatic alert evaluation ("HH:mm", 24 h), once a day,
   * in ALERTS_EVAL_TIMEZONE. "off" disables the daily run. There is also one
   * pass shortly after every start (see alerts.scheduler.ts), and "Evaluar
   * alertas" runs it on demand at any time.
   */
  ALERTS_EVAL_TIME: z
    .string()
    .regex(/^(off|([01]\d|2[0-3]):[0-5]\d)$/, 'Must be "HH:mm" (24 h) or "off"')
    .default('06:00'),

  /** IANA timezone the evaluation time refers to (the company's). */
  ALERTS_EVAL_TIMEZONE: z
    .string()
    .refine(isValidTimeZone, 'Must be an IANA timezone, e.g. America/Argentina/Buenos_Aires')
    .default('America/Argentina/Buenos_Aires'),
});

const parsed = envSchema.safeParse(process.env);

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
