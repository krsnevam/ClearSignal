import { rank, type Village } from '@clearsignal/fusion';
import {
  type ContributingEvent,
  type Ranking,
  type RawEvent,
  SOURCE_BY_ID,
  SOURCES,
  type SourceStatus,
  type Weights,
} from '@clearsignal/schema';
import type { Clock } from './clock';
import type { Store } from './store/types';

export const LOOKBACK_SECONDS = 24 * 3600;

export interface PipelineDeps {
  store: Store;
  clock: Clock;
  weights: Weights;
  villages: readonly Village[];
}

const WEBHOOK_SOURCES = new Set(['twilio-sms', 'msg91-sms']);
const MOCK_SOURCES = new Set(['discom-outage']);

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** Per-source observed→received latency and volume over the recent window. */
function latencyBySource(events: readonly RawEvent[]) {
  const lags = new Map<string, number[]>();
  for (const e of events) {
    const lag = (Date.parse(e.received_at_utc) - Date.parse(e.observed_at_utc)) / 1000;
    if (!Number.isFinite(lag) || lag < 0) continue;
    const list = lags.get(e.source_id) ?? [];
    list.push(lag);
    lags.set(e.source_id, list);
  }
  return lags;
}

export async function sourcesStatus(
  d: PipelineDeps,
  recentEvents?: readonly RawEvent[],
): Promise<SourceStatus[]> {
  const now = d.clock.now();
  const recent =
    recentEvents ??
    (await d.store.eventsBetween(now.getTime() - LOOKBACK_SECONDS * 1000, now.getTime()));
  const lags = latencyBySource(recent);
  const seen = await d.store.lastSeenBySource(now.getTime());
  const health = new Map((await d.store.sourceHealth()).map((h) => [h.source_id, h]));
  return SOURCES.map((s) => {
    const h = health.get(s.source_id);
    const hl = d.weights.source_half_life_seconds[s.source_id] ?? s.refresh_interval_seconds;
    const candidates = [
      seen.get(s.source_id),
      d.clock.scenario ? undefined : h?.last_success_at,
    ].filter((x): x is string => !!x);
    const lastSeen = candidates.sort().at(-1) ?? null;
    const ageS = lastSeen
      ? (now.getTime() - Date.parse(lastSeen)) / 1000
      : Number.POSITIVE_INFINITY;
    const recentError =
      !!h?.last_error_at && (!h.last_success_at || h.last_error_at > h.last_success_at);
    const healthy = WEBHOOK_SOURCES.has(s.source_id)
      ? !recentError
      : ageS <= 2 * Math.max(hl, s.refresh_interval_seconds) && !recentError;
    return {
      source_id: s.source_id,
      display_name: s.display_name,
      tier: s.tier,
      healthy,
      last_seen_utc: lastSeen,
      last_error_at_utc: h?.last_error_at ?? null,
      last_error_msg: h?.last_error_msg ?? null,
      refresh_interval_seconds: s.refresh_interval_seconds,
      half_life_seconds: hl,
      mode: MOCK_SOURCES.has(s.source_id)
        ? 'mock'
        : d.clock.scenario && !WEBHOOK_SOURCES.has(s.source_id)
          ? 'replay'
          : 'live',
      median_latency_seconds: (() => {
        const m = median(lags.get(s.source_id) ?? []);
        return m === null ? null : Math.round(m);
      })(),
      events_24h: lags.get(s.source_id)?.length ?? 0,
    };
  });
}

/** T1/T2 sources that were reporting but have gone silent > multiple × half-life (§10.3). */
export function missingSources(status: readonly SourceStatus[], now: Date, w: Weights): string[] {
  return status
    .filter((s) => (s.tier === 'T1' || s.tier === 'T2') && s.last_seen_utc)
    .filter(
      (s) =>
        (now.getTime() - Date.parse(s.last_seen_utc as string)) / 1000 >
        s.half_life_seconds * w.staleness.missing_source_half_life_multiple,
    )
    .map((s) => s.source_id);
}

export async function computeRanking(
  d: PipelineDeps,
): Promise<{ ranking: Ranking; events: RawEvent[] }> {
  const now = d.clock.now();
  const events = await d.store.eventsBetween(
    now.getTime() - LOOKBACK_SECONDS * 1000,
    now.getTime(),
  );
  const status = await sourcesStatus(d, events);
  const recommendations = rank(events, {
    now,
    weights: d.weights,
    villages: d.villages,
    lookback_seconds: LOOKBACK_SECONDS,
    missing_sources: missingSources(status, now, d.weights),
  });
  return {
    ranking: {
      district: 'kodagu',
      computed_at_utc: new Date().toISOString(),
      scenario_clock_utc: now.toISOString(),
      scenario: d.clock.scenario,
      recommendations,
      sources_status: status,
      formula: { ...d.weights.formula, ...d.weights.bands },
    },
    events,
  };
}

/** One human-readable line per contributing event for the "why" view. */
export function summarize(e: RawEvent): string {
  const r = e.raw_value;
  const num = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : null);
  switch (e.event_type) {
    case 'river_danger':
      return `${r.station ?? 'Gauge'}: ${num('level_m') ?? '?'} m (danger mark ${num('danger_m') ?? '?'} m)`;
    case 'flood_extent':
      return e.normalized_value !== null && e.normalized_value < 1
        ? `Flood probability ${Math.round(e.normalized_value * 100)}% in 500 m cell`
        : 'Flood extent detected in 500 m cell';
    case 'heavy_rain':
      if (num('rain_1h_mm') !== null) return `Rain ${num('rain_1h_mm')} mm/h`;
      if (num('district_total_mm') !== null)
        return `District rainfall ${num('district_total_mm')} mm / 24 h`;
      return String(r.text ?? 'Heavy-rain warning');
    case 'road_impassable':
      return `${r.road ?? 'Road'} blocked${r.cause ? ` (${r.cause})` : ''}`;
    case 'power_outage':
      return `Outage on ${r.feeder ?? 'feeder'}`;
    case 'citizen_report':
      return `“${String(r.body ?? '').slice(0, 140)}”${r.synthetic ? ' (synthetic)' : ''}`;
    default:
      return SOURCE_BY_ID[e.source_id]?.display_name ?? e.source_id;
  }
}

export function toContributing(e: RawEvent, now: Date): ContributingEvent {
  return {
    id: e.id,
    source_id: e.source_id,
    source_tier: e.source_tier,
    event_type: e.event_type,
    observed_at_utc: e.observed_at_utc,
    age_sec: Math.max(0, Math.round((now.getTime() - Date.parse(e.observed_at_utc)) / 1000)),
    polarity: e.polarity,
    normalized_value: e.normalized_value,
    summary: summarize(e),
    raw_value: e.raw_value,
  };
}
