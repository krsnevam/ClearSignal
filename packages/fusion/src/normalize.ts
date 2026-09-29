import { RawEvent, type RawEventInput } from '@clearsignal/schema';

/** 0.005° grid ≈ 500 m at Kodagu's latitude (§8.2 rule 3). */
export function gridCellId(lat: number, lon: number): string {
  const snap = (v: number) => (Math.floor(v * 200) / 200).toFixed(4);
  return `${snap(lat)}_${snap(lon)}_500m`;
}

export interface Village {
  village_id: string;
  place_name: string;
  taluka: string;
  lat: number;
  lon: number;
  population?: number;
}

/** Haversine distance in metres. */
export function distanceM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const VILLAGE_SNAP_RADIUS_M = 3000;

export function nearestVillage(
  lat: number,
  lon: number,
  villages: readonly Village[],
  maxM = VILLAGE_SNAP_RADIUS_M,
): Village | null {
  let best: Village | null = null;
  let bestD = maxM;
  for (const v of villages) {
    const d = distanceM(lat, lon, v.lat, v.lon);
    if (d <= bestD) {
      best = v;
      bestD = d;
    }
  }
  return best;
}

export class NormalizeError extends Error {}

/**
 * Normalize stage (§8.2): validate UTC timestamps & coordinates, snap to the
 * 500 m grid, and enrich place name / taluka from village geometries.
 */
export function normalizeEvent(input: RawEventInput, villages: readonly Village[]): RawEvent {
  const lat = input.location.lat;
  const lon = input.location.lon;
  const v = nearestVillage(lat, lon, villages);
  const candidate = {
    ...input,
    location: {
      ...input.location,
      grid_cell_id: gridCellId(lat, lon),
      place_name: input.location.place_name ?? v?.place_name ?? null,
      taluka: input.location.taluka ?? v?.taluka ?? null,
      district: 'kodagu' as const,
    },
  };
  const parsed = RawEvent.safeParse(candidate);
  if (!parsed.success) {
    throw new NormalizeError(
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  return parsed.data;
}

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Within any (source_id, grid_cell_id, event_type, polarity) 5-minute window
 * keep only the latest observation (§8.2 rule 4). Citizen reports are exempt:
 * each SMS is a distinct observer, deduped instead by its message id upstream.
 */
export function dedupe(events: readonly RawEvent[]): RawEvent[] {
  const sorted = [...events].sort(
    (a, b) => Date.parse(b.observed_at_utc) - Date.parse(a.observed_at_utc),
  );
  const kept: RawEvent[] = [];
  const lastKept = new Map<string, number>();
  for (const e of sorted) {
    if (e.event_type === 'citizen_report') {
      kept.push(e);
      continue;
    }
    const key = `${e.source_id}|${e.location.grid_cell_id}|${e.event_type}|${e.polarity}`;
    const t = Date.parse(e.observed_at_utc);
    const prev = lastKept.get(key);
    if (prev !== undefined && prev - t < DEDUPE_WINDOW_MS) continue;
    lastKept.set(key, t);
    kept.push(e);
  }
  return kept;
}
