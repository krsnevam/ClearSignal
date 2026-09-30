import { z } from 'zod';
import { EventType, SourceTier } from './event';

export const Band = z.enum(['H', 'M', 'L']);
export type Band = z.infer<typeof Band>;

export const ScoreComponents = z.object({
  recency: z.number().min(0).max(1),
  agreement: z.number().min(0).max(1),
  reliability: z.number().min(0).max(1),
});
export type ScoreComponents = z.infer<typeof ScoreComponents>;

/** Language-neutral reason, so each UI language can build its own sentence. */
export const ReasonGroup = z.object({ type: EventType, count: z.number().int().positive() });
export const Reason = z.object({
  kind: z.enum(['none', 'single', 'agree', 'conflict']),
  stale: z.boolean(),
  oldest_age_sec: z.number().int().nonnegative(),
  /** Top three signal types in tier order (hazard side). */
  groups: z.array(ReasonGroup),
  /** Signals beyond the top three types. */
  more: z.number().int().nonnegative(),
  /** kind = 'single': whether the lone signal is an unverified citizen report. */
  unverified: z.boolean(),
  /** kind = 'conflict': the all-clear side. */
  oppose_groups: z.array(ReasonGroup),
  oppose_more: z.number().int().nonnegative(),
});
export type Reason = z.infer<typeof Reason>;

export const Recommendation = z.object({
  id: z.string(),
  village_id: z.string().nullable(),
  place_name: z.string(),
  /** Kannada-script name, when known (village_geometries.name_kn). */
  place_name_kn: z.string().nullable().optional(),
  taluka: z.string(),
  grid_cell_id: z.string(),
  centroid: z.object({ lat: z.number(), lon: z.number() }),
  composite_score: z.number().int().min(0).max(100),
  band: Band,
  components: ScoreComponents,
  reason_text: z.string(),
  reason: Reason.optional(),
  oldest_source_age_sec: z.number().int().nonnegative(),
  conflict_flag: z.boolean(),
  stale_flag: z.boolean(),
  missing_sources: z.array(z.string()),
  contributing_event_ids: z.array(z.string()),
});
export type Recommendation = z.infer<typeof Recommendation>;

export const ContributingEvent = z.object({
  id: z.string(),
  source_id: z.string(),
  source_tier: SourceTier,
  event_type: EventType,
  observed_at_utc: z.string(),
  age_sec: z.number().int(),
  polarity: z.union([z.literal(1), z.literal(-1)]),
  normalized_value: z.number().nullable(),
  summary: z.string(),
  raw_value: z.record(z.unknown()),
});
export type ContributingEvent = z.infer<typeof ContributingEvent>;

export const RecommendationDetail = z.object({
  recommendation: Recommendation,
  events: z.array(ContributingEvent),
  formula: z.object({
    recency_weight: z.number(),
    agreement_weight: z.number(),
    reliability_weight: z.number(),
  }),
});
export type RecommendationDetail = z.infer<typeof RecommendationDetail>;
