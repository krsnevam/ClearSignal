import { describe, expect, it } from 'vitest';
import { computeScore, type ScoringEvent } from './engine';
import { explain, humanAge, reasonParts } from './explain';
import { defaultWeights as w } from './weights';

const say = (events: ScoringEvent[]) => explain(events, computeScore(events, w), w);
const e = (
  source: string,
  tier: ScoringEvent['tier'],
  min: number,
  type: ScoringEvent['type'],
  polarity: 1 | -1 = 1,
): ScoringEvent => ({ source, tier, age_s: min * 60, type, polarity });

describe('explain()', () => {
  it('Village A reads like the submission', () => {
    expect(
      say([
        e('sentinel-1-cdse', 'T2', 22, 'flood_extent'),
        e('discom-outage', 'T4', 8, 'power_outage'),
        e('discom-outage', 'T4', 11, 'power_outage'),
        e('twilio-sms', 'T4', 5, 'citizen_report'),
        e('twilio-sms', 'T4', 12, 'citizen_report'),
        e('twilio-sms', 'T4', 17, 'citizen_report'),
        e('twilio-sms', 'T4', 19, 'citizen_report'),
      ]),
    ).toBe(
      'Satellite flood extent, two power-outage pings, and four SMS reports agree, all within 22 minutes',
    );
  });

  it('Village B is flagged stale and unverified', () => {
    expect(say([e('twilio-sms', 'T4', 180, 'citizen_report')])).toBe(
      'Stale: Single unverified SMS report, 3 hours old, no other source agrees',
    );
  });

  it('orders by tier (T1 first) and groups', () => {
    expect(
      say([
        e('twilio-sms', 'T4', 3, 'citizen_report'),
        e('cwc-wris', 'T1', 10, 'river_danger'),
        e('twilio-sms', 'T4', 4, 'citizen_report'),
      ]),
    ).toBe('River gauge above danger mark and two SMS reports agree, all within 10 minutes');
  });

  it('enumerates both sides of a conflict', () => {
    expect(
      say([
        e('sentinel-1-cdse', 'T2', 40, 'flood_extent'),
        e('twilio-sms', 'T4', 6, 'citizen_report', -1),
      ]),
    ).toBe(
      'Conflict: satellite flood extent says flooded, one SMS report says safe, within 40 minutes',
    );
  });

  it('summarises beyond three groups', () => {
    const text = say([
      e('cwc-wris', 'T1', 5, 'river_danger'),
      e('sentinel-1-cdse', 'T2', 30, 'flood_extent'),
      e('openweather', 'T3', 2, 'heavy_rain'),
      e('overpass', 'T3', 50, 'road_impassable'),
      e('twilio-sms', 'T4', 1, 'citizen_report'),
    ]);
    expect(text).toMatch(/and two more signals agree, all within 50 minutes$/);
  });

  it('rounds ages up', () => {
    expect(humanAge(27 * 60 + 42)).toBe('28 minutes');
    expect(humanAge(30)).toBe('1 minute');
    expect(humanAge(2 * 3600 + 1)).toBe('3 hours');
    expect(humanAge(3 * 86400)).toBe('3 days');
  });
});

describe('reasonParts()', () => {
  const parts = (events: ScoringEvent[]) => reasonParts(events, computeScore(events, w));
  it('mirrors explain() as language-neutral data', () => {
    expect(
      parts([
        e('sentinel-1-cdse', 'T2', 22, 'flood_extent'),
        e('discom-outage', 'T4', 8, 'power_outage'),
        e('twilio-sms', 'T4', 5, 'citizen_report'),
        e('twilio-sms', 'T4', 12, 'citizen_report'),
      ]),
    ).toMatchObject({
      kind: 'agree',
      stale: false,
      oldest_age_sec: 22 * 60,
      groups: [
        { type: 'flood_extent', count: 1 },
        { type: 'power_outage', count: 1 },
        { type: 'citizen_report', count: 2 },
      ],
      more: 0,
    });
    expect(parts([e('twilio-sms', 'T4', 180, 'citizen_report')])).toMatchObject({
      kind: 'single',
      stale: true,
      unverified: true,
    });
    expect(
      parts([
        e('sentinel-1-cdse', 'T2', 40, 'flood_extent'),
        e('twilio-sms', 'T4', 6, 'citizen_report', -1),
      ]),
    ).toMatchObject({ kind: 'conflict', oppose_groups: [{ type: 'citizen_report', count: 1 }] });
  });
});
