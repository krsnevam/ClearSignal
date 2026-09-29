import { defaultWeights, rank } from '@clearsignal/fusion';
import { RawEvent } from '@clearsignal/schema';
import { describe, expect, it } from 'vitest';
import {
  dueBetween,
  KODAGU_2018_EVENTS,
  ReplayClock,
  SCENARIO_VIDEO_START_UTC,
  VILLAGES,
} from './index';

const T0 = Date.parse(SCENARIO_VIDEO_START_UTC);
const rankAt = (minutes: number) =>
  rank(KODAGU_2018_EVENTS, {
    now: new Date(T0 + minutes * 60_000),
    weights: defaultWeights,
    villages: VILLAGES,
  });

describe('Kodagu 2018 fixtures', () => {
  it('every fixture is a valid normalized RawEvent', () => {
    for (const e of KODAGU_2018_EVENTS) expect(() => RawEvent.parse(e)).not.toThrow();
  });

  it('matches the Appendix A counts', () => {
    const count = (f: string) => KODAGU_2018_EVENTS.filter((e) => e.raw_value.fixture === f).length;
    expect(count('landslides.json')).toBe(105);
    expect(count('outages.json')).toBe(18);
    expect(count('sms.json')).toBe(24);
    expect(
      KODAGU_2018_EVENTS.filter((e) => e.event_type === 'citizen_report').every(
        (e) => e.raw_value.synthetic,
      ),
    ).toBe(true);
  });
});

describe('Kodagu 2018 replay — video opening frame (09:00 IST, 16 Aug)', () => {
  const r = rankAt(0);
  const byName = (n: string) => r.find((x) => x.place_name === n);

  it('Makkandur and Bhagamandala lead, both High', () => {
    expect(r.slice(0, 3).map((x) => x.place_name)).toEqual(
      expect.arrayContaining(['Makkandur', 'Bhagamandala']),
    );
    expect(byName('Makkandur')?.band).toBe('H');
    expect(byName('Bhagamandala')?.band).toBe('H');
  });

  it('Mukkodlu surfaces the satellite-vs-SMS conflict at Medium', () => {
    expect(byName('Mukkodlu')).toMatchObject({ band: 'M', conflict_flag: true });
    expect(byName('Mukkodlu')?.reason_text).toMatch(/^Conflict: .*says safe/);
  });

  it('Ponnampet mirrors Village B: lone 3 h-old SMS → Low, stale', () => {
    expect(byName('Ponnampet')).toMatchObject({ band: 'L', stale_flag: true });
    expect(byName('Ponnampet')?.composite_score).toBeGreaterThanOrEqual(14);
    expect(byName('Ponnampet')?.composite_score).toBeLessThanOrEqual(20);
  });

  it('is deterministic', () => {
    expect(rankAt(0)).toEqual(r);
  });
});

describe('ReplayClock', () => {
  it('runs at 60× and feeds due events per tick', () => {
    const clock = new ReplayClock(1_000_000, T0, 60);
    expect(clock.nowSim(1_000_000 + 60_000).getTime()).toBe(T0 + 3_600_000);
    const due = dueBetween(KODAGU_2018_EVENTS, T0, T0 + 3_600_000);
    expect(due.length).toBeGreaterThan(0);
    expect(due.every((e) => Date.parse(e.observed_at_utc) > T0)).toBe(true);
  });
});
