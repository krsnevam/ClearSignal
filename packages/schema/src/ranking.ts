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
  /** Median observed→received delay over the last 24 h (the source's own lag + ours). */
  median_latency_seconds: z.number().nullable(),
  /** Signals received from this source in the last 24 h. */
  events_24h: z.number().int().nonnegative(),
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
  /** The live formula (from weights.yaml) so clients can explain scores without a second copy. */
  formula: z
    .object({
      recency_weight: z.number(),
      agreement_weight: z.number(),
      reliability_weight: z.number(),
      high_threshold: z.number(),
      medium_threshold: z.number(),
    })
    .optional(),
});
export type Ranking = z.infer<typeof Ranking>;
