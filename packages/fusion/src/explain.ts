import type { EventType, Reason, SourceTier, Weights } from '@clearsignal/schema';
import type { Score, ScoringEvent } from './engine';

const TIER_RANK: Record<SourceTier, number> = { T1: 0, T2: 1, T3: 2, T4: 3 };

const LABELS: Record<EventType, [singular: string, plural: string]> = {
  flood_extent: ['satellite flood extent', 'satellite flood detections'],
  heavy_rain: ['heavy-rain reading', 'heavy-rain readings'],
  river_danger: ['river gauge above danger mark', 'river gauges above danger mark'],
  road_impassable: ['blocked-road report', 'blocked-road reports'],
  power_outage: ['power-outage ping', 'power-outage pings'],
  thermal_anomaly: ['thermal hotspot', 'thermal hotspots'],
  earthquake: ['earthquake alert', 'earthquake alerts'],
  multi_hazard_alert: ['GDACS alert', 'GDACS alerts'],
  citizen_report: ['SMS report', 'SMS reports'],
};

const TYPE_ORDER = Object.keys(LABELS) as EventType[];

const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
];

function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** "28 minutes" not "27m 42s" — always rounds up so the claim is never optimistic. */
export function humanAge(seconds: number): string {
  const min = Math.max(1, Math.ceil(seconds / 60));
  if (min < 90) return `${min} minute${min === 1 ? '' : 's'}`;
  const hours = Math.ceil(seconds / 3600);
  if (hours < 48) return `${hours} hours`;
  return `${Math.ceil(seconds / 86400)} days`;
}

interface Group {
  type: EventType;
  count: number;
  bestTier: number;
}

function groupsOf(events: readonly ScoringEvent[]): Group[] {
  const byType = new Map<EventType, Group>();
  for (const e of events) {
    const g = byType.get(e.type) ?? { type: e.type, count: 0, bestTier: 9 };
    g.count += 1;
    g.bestTier = Math.min(g.bestTier, TIER_RANK[e.tier]);
    byType.set(e.type, g);
  }
  // Tier order T1 > T2 > T3 > T4; within a tier, measured signals before reports.
  return [...byType.values()].sort(
    (a, b) => a.bestTier - b.bestTier || TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type),
  );
}

function phrase(g: Group, leadingSingular: boolean): string {
  const [one, many] = LABELS[g.type];
  if (g.count === 1) return leadingSingular ? one : `one ${one}`;
  return `${countWord(g.count)} ${many}`;
}

function list(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
}

function describe(
  events: readonly ScoringEvent[],
  leading = true,
): { text: string; plural: boolean } {
  const groups = groupsOf(events);
  const top = groups.slice(0, 3);
  const parts = top.map((g, i) => phrase(g, leading && i === 0));
  const rest = groups.slice(3).reduce((n, g) => n + g.count, 0);
  if (rest > 0) parts.push(`${countWord(rest)} more signal${rest === 1 ? '' : 's'}`);
  return { text: list(parts), plural: events.length > 1 };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Explain stage (§9.5). Names the top three contributing event types in tier
 * order, groups repeats, ends with the oldest signal's age, and prefixes
 * "Stale: " / "Conflict: " when warranted.
 */
export function explain(events: readonly ScoringEvent[], score: Score, _w: Weights): string {
  if (events.length === 0) return 'No signals';
  const age = humanAge(score.oldest_age_s);
  const prefix = score.stale ? 'Stale: ' : '';

  if (score.conflict) {
    const support = events.filter((e) => (e.polarity ?? 1) === 1);
    const oppose = events.filter((e) => e.polarity === -1);
    const s = describe(support);
    const o = describe(oppose, false);
    return `${prefix}Conflict: ${s.text} ${s.plural ? 'say' : 'says'} flooded, ${o.text} ${
      o.plural ? 'say' : 'says'
    } safe, within ${age}`;
  }

  if (events.length === 1) {
    const only = events[0] as ScoringEvent;
    const [one] = LABELS[only.type];
    const qualifier = only.tier === 'T4' ? 'unverified ' : '';
    return `${prefix}Single ${qualifier}${one}, ${age} old, no other source agrees`;
  }

  const d = describe(events);
  const body = `${d.text} agree, all within ${age}`;
  return prefix ? `${prefix}${body}` : capitalize(body);
}

function topGroups(events: readonly ScoringEvent[]) {
  const groups = groupsOf(events);
  return {
    groups: groups.slice(0, 3).map((g) => ({ type: g.type, count: g.count })),
    more: groups.slice(3).reduce((n, g) => n + g.count, 0),
  };
}

/** The same decision explain() makes, as data — rendered per language by the app. */
export function reasonParts(events: readonly ScoringEvent[], score: Score): Reason {
  const base = {
    stale: score.stale,
    oldest_age_sec: score.oldest_age_s,
    unverified: false,
    oppose_groups: [] as Reason['oppose_groups'],
    oppose_more: 0,
  };
  if (events.length === 0) return { ...base, kind: 'none', groups: [], more: 0 };
  if (score.conflict) {
    const s = topGroups(events.filter((e) => (e.polarity ?? 1) === 1));
    const o = topGroups(events.filter((e) => e.polarity === -1));
    return { ...base, kind: 'conflict', ...s, oppose_groups: o.groups, oppose_more: o.more };
  }
  if (events.length === 1) {
    const only = events[0] as ScoringEvent;
    return {
      ...base,
      kind: 'single',
      unverified: only.tier === 'T4',
      groups: [{ type: only.type, count: 1 }],
      more: 0,
    };
  }
  return { ...base, kind: 'agree', ...topGroups(events) };
}
