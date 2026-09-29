import { z } from 'zod';

const Env = z.object({
  DATABASE_URL: z.string().optional(),
  INGEST_TOKEN: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  MSG91_WEBHOOK_TOKEN: z.string().optional(),
  SMS_HASH_SALT: z.string().default('clearsignal-dev-salt'),
  REPLAY_MODE: z.enum(['kodagu-2018', 'off']).default('kodagu-2018'),
  REPLAY_SPEED: z.coerce.number().positive().default(60),
  REPLAY_SIM_START: z.string().datetime().default('2018-08-16T03:30:00Z'),
  REPLAY_LOOP_SIM_HOURS: z.coerce.number().positive().default(3),
  /** Wall-clock instant the replay loop is anchored to; shared by every isolate. */
  REPLAY_ANCHOR_UTC: z.string().datetime().default('2026-01-01T00:00:00Z'),
  ALLOWED_ORIGINS: z.string().default('*'),
  /** Public URL Twilio posts to — needed to verify signatures behind proxies. */
  PUBLIC_WEBHOOK_URL: z.string().url().optional(),
});
export type Config = z.infer<typeof Env>;

export function loadConfig(env: Record<string, unknown>): Config {
  // Treat empty strings (unset .env entries) as absent.
  const cleaned = Object.fromEntries(
    Object.entries(env).filter(([, v]) => typeof v === 'string' && v !== ''),
  );
  return Env.parse(cleaned);
}
