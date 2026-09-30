import type { Ranking } from '@clearsignal/schema';
import { describe, expect, it } from 'vitest';
import { bannerFor } from './status';

const NOW = Date.parse('2026-09-30T10:00:00Z');
const ranking = (lastSeenMinAgo: number): Ranking => ({
  district: 'kodagu',
  computed_at_utc: new Date(NOW).toISOString(),
  scenario_clock_utc: '2018-08-16T04:00:00.000Z',
  scenario: 'kodagu-2018',
  recommendations: [],
  sources_status: [
    {
      source_id: 'cwc-wris',
      display_name: 'CWC',
      tier: 'T1',
      healthy: true,
      last_seen_utc: new Date(
        Date.parse('2018-08-16T04:00:00Z') - lastSeenMinAgo * 60_000,
      ).toISOString(),
      last_error_at_utc: null,
      last_error_msg: null,
      refresh_interval_seconds: 3600,
      half_life_seconds: 3600,
      mode: 'replay',
      median_latency_seconds: 600,
      events_24h: 4,
    },
  ],
});

describe('bannerFor — §10.3 offline table', () => {
  it('online + fresh → no banner', () => {
    expect(
      bannerFor({ online: true, reachable: true, syncedAt: NOW, ranking: ranking(5), nowMs: NOW }),
    ).toEqual({ kind: 'none' });
  });
  it('online + every source quiet > 15 min → stale', () => {
    expect(
      bannerFor({ online: true, reachable: true, syncedAt: NOW, ranking: ranking(16), nowMs: NOW })
        .kind,
    ).toBe('stale');
  });
  it('offline with < 24 h cache → offline, stamped with sync time', () => {
    const b = bannerFor({
      online: false,
      reachable: true,
      syncedAt: NOW - 3600_000,
      ranking: ranking(5),
      nowMs: NOW,
    });
    expect(b).toEqual({ kind: 'offline', since: NOW - 3600_000 });
  });
  it('API unreachable counts as offline', () => {
    expect(
      bannerFor({ online: true, reachable: false, syncedAt: NOW, ranking: ranking(5), nowMs: NOW })
        .kind,
    ).toBe('offline');
  });
  it('offline with > 24 h cache → expired', () => {
    expect(
      bannerFor({
        online: false,
        reachable: false,
        syncedAt: NOW - 25 * 3600_000,
        ranking: ranking(5),
        nowMs: NOW,
      }).kind,
    ).toBe('expired');
  });
  it('offline with nothing cached → expired', () => {
    expect(
      bannerFor({ online: false, reachable: false, syncedAt: null, ranking: null, nowMs: NOW }),
    ).toEqual({ kind: 'expired', since: null });
  });
});
