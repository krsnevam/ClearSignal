import type {
  Band,
  EventType,
  RawEvent,
  Recommendation,
  ScoreComponents,
  SourceTier,
  Weights,
} from '@clearsignal/schema';
import { explain, reasonParts } from './explain';
import { gridCellId, nearestVillage, type Village } from './normalize';

/** The minimal view of an event the confidence formula needs. */
export interface ScoringEvent {
  source: string;
  tier: SourceTier;
  age_s: number;
  type: EventType;
  /** +1 hazard present (default), -1 all-clear. */
  polarity?: 1 | -1;
}

export interface Score {
  composite: number; // integer 0–100
  band: Band;
  components: ScoreComponents;
  conflict: boolean;
  stale: boolean;
  oldest_age_s: number;
}

function halfLife(source: string, w: Weights): number {
  const hl = w.source_half_life_seconds[source];
  if (hl === undefined) throw new Error(`No half-life configured for source '${source}'`);
  return hl;
}

function decay(e: ScoringEvent, w: Weights): number {
  return Math.exp(-Math.max(0, e.age_s) / halfLife(e.source, w));
}

/**
 * Independent-source count. Each distinct tier counts 1.0; every further
 * report from an already-counted tier counts `same_tier_report_weight`
 * (independence_by: tier — same-tier signals corroborate but are not fully
 * independent of each other).
 */
function independentCount(events: readonly ScoringEvent[], w: Weights): number {
  if (events.length === 0) return 0;
  const tiers = new Set(events.map((e) => e.tier));
  return tiers.size + w.agreement.same_tier_report_weight * (events.length - tiers.size);
}

export function bandFor(composite: number, w: Weights): Band {
  if (composite >= w.bands.high_threshold) return 'H';
  if (composite >= w.bands.medium_threshold) return 'M';
  return 'L';
}

/**
 * Score = 0.35 × recency + 0.45 × agreement + 0.20 × reliability (§9.1),
 * with the weights read from weights.yaml.
 */
export function computeScore(events: readonly ScoringEvent[], w: Weights): Score {
  if (events.length === 0) {
    return {
      composite: 0,
      band: 'L',
      components: { recency: 0, agreement: 0, reliability: 0 },
      conflict: false,
      stale: false,
      oldest_age_s: 0,
    };
  }

  const decays = events.map((e) => decay(e, w));

  // Recency — freshest signal wins.
  const recency = Math.max(...decays);

  // Agreement — measured over signals within window_seconds of the newest
  // contributing signal, so corroboration is about signals agreeing with each
  // other in time; absolute staleness is recency's job.
  const newest = Math.min(...events.map((e) => e.age_s));
  const inWindow = events.filter((e) => e.age_s - newest <= w.agreement.window_seconds);
  const support = inWindow.filter((e) => (e.polarity ?? 1) === 1);
  const oppose = inWindow.filter((e) => (e.polarity ?? 1) === -1);
  const net = independentCount(support, w) - independentCount(oppose, w);
  const agreement = Math.min(1, Math.max(0, net / w.agreement.max_sources_for_full_score));

  // Reliability — tier weights, weighted by each signal's recency so a fresh
  // T1 reading outweighs a stale T4 one. Falls back to a plain mean when every
  // signal has fully decayed.
  const totalDecay = decays.reduce((a, b) => a + b, 0);
  const reliability =
    totalDecay > 1e-9
      ? events.reduce((acc, e, i) => acc + (decays[i] ?? 0) * w.tier_weights[e.tier], 0) /
        totalDecay
      : events.reduce((acc, e) => acc + w.tier_weights[e.tier], 0) / events.length;

  const raw =
    w.formula.recency_weight * recency +
    w.formula.agreement_weight * agreement +
    w.formula.reliability_weight * reliability;
  const composite = Math.round(Math.min(1, Math.max(0, raw)) * 100);

  // Stale when no contributing source has a signal younger than its half-life.
  const freshestBySource = new Map<string, number>();
  for (const e of events) {
    freshestBySource.set(e.source, Math.min(freshestBySource.get(e.source) ?? Infinity, e.age_s));
  }
  const stale = [...freshestBySource].every(([src, age]) => age > halfLife(src, w));

  return {
    composite,
    band: bandFor(composite, w),
    components: { recency, agreement, reliability },
    conflict: support.length > 0 && oppose.length > 0,
    stale,
    oldest_age_s: Math.max(...events.map((e) => e.age_s)),
  };
}

// ─── Rank stage ──────────────────────────────────────────────────────────────

export interface RankOptions {
  now: Date;
  weights: Weights;
  villages: readonly Village[];
  /** Only events observed in (now - lookback, now] contribute. */
  lookback_seconds?: number;
  /** T1/T2 sources currently silent beyond their staleness threshold. */
  missing_sources?: readonly string[];
  /** Drop candidates scoring below this (keeps the list focused). */
  min_score?: number;
}

export interface Candidate {
  key: string;
  village: Village | null;
  lat: number;
  lon: number;
  events: RawEvent[];
}

/** Group events into candidate locations: nearest village, else raw grid cell. */
export function groupCandidates(
  events: readonly RawEvent[],
  villages: readonly Village[],
): Candidate[] {
  const byKey = new Map<string, Candidate>();
  for (const e of events) {
    const v = nearestVillage(e.location.lat, e.location.lon, villages);
    const key = v ? v.village_id : e.location.grid_cell_id;
    let c = byKey.get(key);
    if (!c) {
      c = {
        key,
        village: v,
        lat: v?.lat ?? e.location.lat,
        lon: v?.lon ?? e.location.lon,
        events: [],
      };
      byKey.set(key, c);
    }
    c.events.push(e);
  }
  return [...byKey.values()];
}

export function toScoringEvent(e: RawEvent, now: Date): ScoringEvent {
  return {
    source: e.source_id,
    tier: e.source_tier,
    age_s: Math.max(0, Math.round((now.getTime() - Date.parse(e.observed_at_utc)) / 1000)),
    type: e.event_type,
    polarity: e.polarity,
  };
}

/**
 * Top-N contributing events: those whose recency decay is still ≥ min_recency,
 * freshest-weighted first. If none qualify, the single freshest event is kept so
 * the location still appears — flagged Stale — rather than silently vanishing.
 */
export function contributing(events: readonly RawEvent[], now: Date, w: Weights): RawEvent[] {
  const scored = events
    .map((e) => ({ e, d: decay(toScoringEvent(e, now), w) }))
    .sort((a, b) => b.d - a.d);
  const kept = scored
    .filter((x) => x.d >= w.contribution.min_recency)
    .slice(0, w.contribution.max_events);
  const first = scored[0];
  return kept.length > 0 ? kept.map((x) => x.e) : first ? [first.e] : [];
}

/** Fuse → Rank → Explain for every candidate location. */
export function rank(events: readonly RawEvent[], opts: RankOptions): Recommendation[] {
  const { now, weights: w, villages } = opts;
  const lookbackMs = (opts.lookback_seconds ?? 24 * 3600) * 1000;
  const nowMs = now.getTime();
  const live = events.filter((e) => {
    const t = Date.parse(e.observed_at_utc);
    return t <= nowMs && nowMs - t <= lookbackMs;
  });

  const recs: Recommendation[] = [];
  for (const c of groupCandidates(live, villages)) {
    c.events = contributing(c.events, now, w);
    const scoring = c.events.map((e) => toScoringEvent(e, now));
    const s = computeScore(scoring, w);
    if (s.composite < (opts.min_score ?? 0)) continue;
    recs.push({
      id: c.key, // stable per location so cached detail views stay valid
      village_id: c.village?.village_id ?? null,
      place_name: c.village?.place_name ?? c.events[0]?.location.place_name ?? c.key,
      place_name_kn: c.village?.name_kn ?? null,
      taluka: c.village?.taluka ?? c.events[0]?.location.taluka ?? 'Unknown',
      grid_cell_id: gridCellId(c.lat, c.lon),
      centroid: { lat: c.lat, lon: c.lon },
      composite_score: s.composite,
      band: s.band,
      components: s.components,
      reason_text: explain(scoring, s, w),
      reason: reasonParts(scoring, s),
      oldest_source_age_sec: s.oldest_age_s,
      conflict_flag: s.conflict,
      stale_flag: s.stale,
      missing_sources: [...(opts.missing_sources ?? [])],
      contributing_event_ids: c.events.map((e) => e.id),
    });
  }
  // Highest score first; ties broken by freshest oldest-source, then name for stability.
  return recs.sort(
    (a, b) =>
      b.composite_score - a.composite_score ||
      a.oldest_source_age_sec - b.oldest_source_age_sec ||
      a.place_name.localeCompare(b.place_name),
  );
}
