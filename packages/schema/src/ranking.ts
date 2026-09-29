import { z } from 'zod';
import { SourceTier } from './event';
import { Recommendation } from './recommendation';

export const SourceStatus = z.object({
  source_id: z.string(),
  display_name: z.string(),
  tier: SourceTier,
  healthy: z.boolean(),
  last_seen_utc: z.string().nullable(),
  last_error_at_utc: z.string().nullable(),
  last_error_msg: z.string().nullable(),
  refresh_interval_seconds: z.number().int(),
  half_life_seconds: z.number().int(),
  mode: z.enum(['live', 'replay', 'mock']),
});
export type SourceStatus = z.infer<typeof SourceStatus>;

export const Ranking = z.object({
  district: z.literal('kodagu'),
  computed_at_utc: z.string().datetime(),
  // Simulated clock when running the Kodagu 2018 replay; equals computed_at_utc when live.
  scenario_clock_utc: z.string().datetime(),
  scenario: z.string().nullable(),
  recommendations: z.array(Recommendation),
  sources_status: z.array(SourceStatus),
});
export type Ranking = z.infer<typeof Ranking>;
