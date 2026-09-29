import { z } from 'zod';

export const Weights = z
  .object({
    version: z.union([z.string(), z.number()]),
    formula: z.object({
      recency_weight: z.number().min(0).max(1),
      agreement_weight: z.number().min(0).max(1),
      reliability_weight: z.number().min(0).max(1),
    }),
    bands: z.object({
      high_threshold: z.number(),
      medium_threshold: z.number(),
    }),
    tier_weights: z.object({ T1: z.number(), T2: z.number(), T3: z.number(), T4: z.number() }),
    source_half_life_seconds: z.record(z.number().positive()),
    agreement: z.object({
      window_seconds: z.number().positive(),
      independence_by: z.literal('tier'),
      same_tier_report_weight: z.number().min(0).max(1),
      max_sources_for_full_score: z.number().positive(),
    }),
    contribution: z.object({
      min_recency: z.number().min(0).max(1),
      max_events: z.number().int().positive(),
    }),
    staleness: z.object({
      missing_source_half_life_multiple: z.number().positive(),
    }),
  })
  .refine(
    (w) =>
      Math.abs(
        w.formula.recency_weight + w.formula.agreement_weight + w.formula.reliability_weight - 1,
      ) < 1e-9,
    { message: 'formula weights must sum to 1.0' },
  );
export type Weights = z.infer<typeof Weights>;
