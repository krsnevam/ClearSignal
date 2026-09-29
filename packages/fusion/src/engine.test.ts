import { describe, expect, it } from 'vitest';
import { computeScore, rank, type ScoringEvent } from './engine';
import { dedupe, gridCellId, normalizeEvent } from './normalize';
import { defaultWeights as weights } from './weights';

// ── Golden test (§9.4) — merge blocker. Reproduces the submission's worked example.
describe('Village A / Village B golden case', () => {
  it('Village A: 7 independent signals agreeing → Score 87 → High', () => {
    const events: ScoringEvent[] = [
      { source: 'sentinel-1-cdse', tier: 'T2', age_s: 22 * 60, type: 'flood_extent' },
      { source: 'discom-outage', tier: 'T4', age_s: 8 * 60, type: 'power_outage' },
      { source: 'discom-outage', tier: 'T4', age_s: 11 * 60, type: 'power_outage' },
      { source: 'twilio-sms', tier: 'T4', age_s: 5 * 60, type: 'citizen_report' },
      { source: 'twilio-sms', tier: 'T4', age_s: 12 * 60, type: 'citizen_report' },
      { source: 'twilio-sms', tier: 'T4', age_s: 17 * 60, type: 'citizen_report' },
      { source: 'twilio-sms', tier: 'T4', age_s: 19 * 60, type: 'citizen_report' },
    ];
    const s = computeScore(events, weights);
    expect(s.composite).toBeGreaterThanOrEqual(85);
    expect(s.composite).toBeLessThanOrEqual(89);
    expect(s.composite).toBe(87);
    expect(s.band).toBe('H');
  });

  it('Village B: 1 unverified post, 3h old → Score ~17 → Low', () => {
    const events: ScoringEvent[] = [
      { source: 'twilio-sms', tier: 'T4', age_s: 3 * 3600, type: 'citizen_report' },
    ];
    const s = computeScore(events, weights);
    expect(s.composite).toBeGreaterThanOrEqual(14);
    expect(s.composite).toBeLessThanOrEqual(20);
    expect(s.band).toBe('L');
    expect(s.stale).toBe(true);
  });
});

describe('computeScore components', () => {
  it('bands at the configured thresholds', () => {
    const one = (age: number): ScoringEvent => ({
      source: 'cwc-wris',
      tier: 'T1',
      age_s: age,
      type: 'river_danger',
    });
    // fresh T1 alone: 0.35·1 + 0.45·0.25 + 0.2·1 = 66.25 → Medium
    expect(computeScore([one(0)], weights)).toMatchObject({ composite: 66, band: 'M' });
  });

  it('all-clear reports cancel agreement and raise conflict', () => {
    const s = computeScore(
      [
        { source: 'sentinel-1-cdse', tier: 'T2', age_s: 1800, type: 'flood_extent' },
        { source: 'twilio-sms', tier: 'T4', age_s: 300, type: 'citizen_report', polarity: -1 },
      ],
      weights,
    );
    expect(s.conflict).toBe(true);
    expect(s.components.agreement).toBe(0);
  });

  it('agreement window is relative to the newest signal', () => {
    const s = computeScore(
      [
        { source: 'twilio-sms', tier: 'T4', age_s: 60, type: 'citizen_report' },
        { source: 'cwc-wris', tier: 'T1', age_s: 60 + 3601, type: 'river_danger' },
      ],
      weights,
    );
    expect(s.components.agreement).toBe(0.25);
  });

  it('rejects unknown sources rather than silently scoring them', () => {
    expect(() =>
      computeScore([{ source: 'rogue', tier: 'T1', age_s: 0, type: 'flood_extent' }], weights),
    ).toThrow(/half-life/);
  });

  it('weights sum to 1', () => {
    const f = weights.formula;
    expect(f.recency_weight + f.agreement_weight + f.reliability_weight).toBeCloseTo(1);
  });
});

describe('normalize', () => {
  const villages = [
    { village_id: 'kdg-a', place_name: 'Alpha', taluka: 'Madikeri', lat: 12.4, lon: 75.7 },
  ];

  it('snaps to the 0.005° grid', () => {
    expect(gridCellId(12.4123, 75.7245)).toBe('12.4100_75.7200_500m');
  });

  it('enriches place and rejects non-UTC timestamps', () => {
    const base = {
      id: '8f6c8f8e-5d1c-4c64-9d4a-3f2b8a1f0e11',
      source_id: 'twilio-sms',
      source_tier: 'T4' as const,
      event_type: 'citizen_report' as const,
      location: {
        lat: 12.401,
        lon: 75.701,
        grid_cell_id: '',
        place_name: null,
        taluka: null,
        district: 'kodagu' as const,
      },
      observed_at_utc: '2018-08-16T09:00:00Z',
      received_at_utc: '2018-08-16T09:00:01Z',
      raw_value: {},
      normalized_value: null,
      confidence_hint: null,
    };
    const e = normalizeEvent(base, villages);
    expect(e.location.place_name).toBe('Alpha');
    expect(e.polarity).toBe(1);
    expect(() =>
      normalizeEvent({ ...base, observed_at_utc: '2018-08-16 14:30 IST' }, villages),
    ).toThrow();
  });

  it('dedupes same-source same-cell readings within 5 minutes, keeping the latest', () => {
    const mk = (id: string, t: string) =>
      normalizeEvent(
        {
          id,
          source_id: 'cwc-wris',
          source_tier: 'T1',
          event_type: 'river_danger',
          location: {
            lat: 12.4,
            lon: 75.7,
            grid_cell_id: '',
            place_name: null,
            taluka: null,
            district: 'kodagu',
          },
          observed_at_utc: t,
          received_at_utc: t,
          raw_value: {},
          normalized_value: 1,
          confidence_hint: null,
        },
        villages,
      );
    const out = dedupe([
      mk('00000000-0000-4000-8000-000000000001', '2018-08-16T09:00:00Z'),
      mk('00000000-0000-4000-8000-000000000002', '2018-08-16T09:03:00Z'),
      mk('00000000-0000-4000-8000-000000000003', '2018-08-16T09:10:00Z'),
    ]);
    expect(out.map((e) => e.id.slice(-1)).sort()).toEqual(['2', '3']);
  });
});

describe('rank', () => {
  it('orders by composite and ignores future events', () => {
    const villages = [
      { village_id: 'a', place_name: 'A', taluka: 'T', lat: 12.4, lon: 75.7 },
      { village_id: 'b', place_name: 'B', taluka: 'T', lat: 12.2, lon: 75.9 },
    ];
    const now = new Date('2018-08-16T10:00:00Z');
    const ev = (id: string, lat: number, lon: number, t: string, source = 'cwc-wris') =>
      normalizeEvent(
        {
          id,
          source_id: source,
          source_tier: source === 'cwc-wris' ? 'T1' : 'T4',
          event_type: source === 'cwc-wris' ? 'river_danger' : 'citizen_report',
          location: {
            lat,
            lon,
            grid_cell_id: '',
            place_name: null,
            taluka: null,
            district: 'kodagu',
          },
          observed_at_utc: t,
          received_at_utc: t,
          raw_value: {},
          normalized_value: null,
          confidence_hint: null,
        },
        villages,
      );
    const recs = rank(
      [
        ev('00000000-0000-4000-8000-00000000000a', 12.4, 75.7, '2018-08-16T09:50:00Z'),
        ev(
          '00000000-0000-4000-8000-00000000000b',
          12.2,
          75.9,
          '2018-08-16T07:00:00Z',
          'twilio-sms',
        ),
        ev('00000000-0000-4000-8000-00000000000c', 12.2, 75.9, '2018-08-16T11:00:00Z'),
      ],
      { now, weights, villages },
    );
    expect(recs.map((r) => r.village_id)).toEqual(['a', 'b']);
    expect(recs[1]?.contributing_event_ids).toHaveLength(1);
  });
});
