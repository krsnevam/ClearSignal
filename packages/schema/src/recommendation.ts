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

export const Recommendation = z.object({
  id: z.string(),
  village_id: z.string().nullable(),
  place_name: z.string(),
  taluka: z.string(),
  grid_cell_id: z.string(),
  centroid: z.object({ lat: z.number(), lon: z.number() }),
  composite_score: z.number().int().min(0).max(100),
  band: Band,
  components: ScoreComponents,
  reason_text: z.string(),
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
