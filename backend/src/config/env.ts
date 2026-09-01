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

  // --- Deployment (single-service: Express serves the built SPA) ---
  /** When true the API also serves the React build (same origin → no CORS). */
  SERVE_STATIC: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** Folder (relative to the process CWD) holding the built SPA. */
  STATIC_DIR: z.string().default('public'),
  /**
   * Number of reverse proxies in front of the app (Railway/Render = 1).
   * Needed so express-rate-limit sees the real client IP and `secure`
   * cookies are recognised behind TLS termination.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  /**
   * SameSite policy for the refresh cookie. 'strict' works when the SPA is
   * served from the same origin as the API (the default deployment).
   * Use 'none' only if the frontend lives on a different domain — it then
   * requires HTTPS and is blocked by browsers that reject third-party cookies.
   */
  COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
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
});

const parsed = envSchema.safeParse(process.env);

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
