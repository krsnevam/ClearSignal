import type { Recommendation } from '@clearsignal/schema';
import { beforeAll, describe, expect, it } from 'vitest';
import { dispatchMessage } from '../dispatch';
import { en } from './en';
import { hi } from './hi';
import { loadLocale, longAge, placeName, translate } from './index';
import { kn } from './kn';
import { reasonText } from './reason';

const rec: Recommendation = {
  id: 'kdg-makkandur',
  village_id: 'kdg-makkandur',
  place_name: 'Makkandur',
  place_name_kn: 'ಮಕ್ಕಂದೂರು',
  taluka: 'Madikeri',
  grid_cell_id: 'x',
  centroid: { lat: 12.4632, lon: 75.7628 },
  composite_score: 87,
  band: 'H',
  components: { recency: 0.94, agreement: 1, reliability: 0.46 },
  reason_text:
    'Satellite flood extent, two power-outage pings, and four SMS reports agree, all within 22 minutes',
  reason: {
    kind: 'agree',
    stale: false,
    oldest_age_sec: 22 * 60,
    groups: [
      { type: 'flood_extent', count: 1 },
      { type: 'power_outage', count: 2 },
      { type: 'citizen_report', count: 4 },
    ],
    more: 0,
    unverified: false,
    oppose_groups: [],
    oppose_more: 0,
  },
  oldest_source_age_sec: 22 * 60,
  conflict_flag: false,
  stale_flag: false,
  missing_sources: [],
  contributing_event_ids: [],
};

beforeAll(async () => {
  await loadLocale('kn');
  await loadLocale('hi');
});

describe('dictionaries', () => {
  it('Kannada and Hindi define every English key, with the same placeholders', () => {
    const vars = (m: unknown) =>
      JSON.stringify(m)
        .match(/\{\w+\}/g)
        ?.sort()
        .filter((v, i, a) => a.indexOf(v) === i) ?? [];
    for (const [name, dict] of [
      ['kn', kn],
      ['hi', hi],
    ] as const) {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(dict[key], `${name}: ${key}`).toBeDefined();
        // Every placeholder the English uses must survive translation (plural `{n}` may be implicit).
        const missing = vars(en[key]).filter((v) => v !== '{n}' && !vars(dict[key]).includes(v));
        expect(missing, `${name}: ${key}`).toEqual([]);
      }
    }
  });

  it('interpolates and picks plural forms', () => {
    expect(translate('en', 'card.signals', { n: 1 })).toBe('1 signal');
    expect(translate('en', 'card.signals', { n: 3 })).toBe('3 signals');
    expect(translate('hi', 'age.hour', { n: 1 })).toBe('1 घंटा');
    expect(translate('hi', 'age.hour', { n: 3 })).toBe('3 घंटे');
    expect(longAge(3 * 3600, 'kn')).toBe('3 ಗಂಟೆ');
  });
});

describe('reasonText', () => {
  it('English uses the server sentence verbatim', () => {
    expect(reasonText(rec, 'en')).toBe(rec.reason_text);
  });

  it('Kannada builds its own sentence with native list joining', () => {
    const s = reasonText(rec, 'kn');
    expect(s).toContain('ಉಪಗ್ರಹ ಪ್ರವಾಹ ವ್ಯಾಪ್ತಿ');
    expect(s).toContain('2 ವಿದ್ಯುತ್ ಕಡಿತ ಸೂಚನೆಗಳು');
    expect(s).toContain('ಮತ್ತು');
    expect(s).toContain('22 ನಿಮಿಷ');
  });

  it('Hindi handles conflict and stale', () => {
    const s = reasonText(
      {
        ...rec,
        reason: {
          ...(rec.reason as NonNullable<Recommendation['reason']>),
          kind: 'conflict',
          stale: true,
          groups: [{ type: 'flood_extent', count: 1 }],
          oppose_groups: [{ type: 'citizen_report', count: 2 }],
        },
      },
      'hi',
    );
    expect(s).toMatch(
      /^पुराना डेटा: विरोधाभास: उपग्रह बाढ़ क्षेत्र बाढ़ बताते हैं, 2 SMS रिपोर्ट सुरक्षित बताते हैं/,
    );
  });

  it('falls back to the server sentence when no structure is cached', () => {
    expect(reasonText({ ...rec, reason: undefined }, 'kn')).toBe(rec.reason_text);
  });
});

describe('names and dispatch', () => {
  it('Kannada shows Kannada-script village names; Hindi keeps map names', () => {
    expect(placeName(rec, 'kn')).toBe('ಮಕ್ಕಂದೂರು');
    expect(placeName(rec, 'hi')).toBe('Makkandur');
  });

  it('writes the dispatch message in the officer’s language, coordinates unchanged', () => {
    const m = dispatchMessage(rec, 1, '2018-08-16T03:30:00Z', 'kn');
    expect(m).toContain('ಆದ್ಯತೆ #1: ಮಕ್ಕಂದೂರು (ಮಡಿಕೇರಿ ತಾಲೂಕು)');
    expect(m).toContain('https://maps.google.com/?q=12.46320,75.76280');
  });
});
