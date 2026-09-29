import type { Ranking } from '@clearsignal/schema';

export type Banner =
  | { kind: 'none' }
  | { kind: 'stale' }
  | { kind: 'offline'; since: number }
  | { kind: 'expired'; since: number | null };

const FIFTEEN_MIN = 15 * 60 * 1000;
const DAY = 24 * 3600 * 1000;

/** Offline behaviour table, spec §10.3. */
export function bannerFor(args: {
  online: boolean;
  reachable: boolean;
  syncedAt: number | null;
  ranking: Ranking | null;
  nowMs: number;
}): Banner {
  const { online, reachable, syncedAt, ranking, nowMs } = args;
  if (!online || !reachable) {
    if (syncedAt === null || nowMs - syncedAt > DAY) return { kind: 'expired', since: syncedAt };
    return { kind: 'offline', since: syncedAt };
  }
  if (!ranking) return { kind: 'none' };
  // Online but every polled source has been quiet > 15 min (on the scenario clock).
  const clock = Date.parse(ranking.scenario_clock_utc);
  const polled = ranking.sources_status.filter(
    (s) => s.refresh_interval_seconds > 0 && s.last_seen_utc,
  );
  if (polled.length === 0) return { kind: 'none' };
  const newest = Math.max(...polled.map((s) => Date.parse(s.last_seen_utc as string)));
  return clock - newest > FIFTEEN_MIN ? { kind: 'stale' } : { kind: 'none' };
}
