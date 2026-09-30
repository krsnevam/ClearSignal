import type { Recommendation } from '@clearsignal/schema';
import { describe, expect, it } from 'vitest';
import { dispatchMessage, smsHref } from './dispatch';

const rec: Recommendation = {
  id: 'kdg-bhagamandala',
  village_id: 'kdg-bhagamandala',
  place_name: 'Bhagamandala',
  taluka: 'Madikeri',
  grid_cell_id: 'x',
  centroid: { lat: 12.3858, lon: 75.5333 },
  composite_score: 91,
  band: 'H',
  components: { recency: 1, agreement: 1, reliability: 1 },
  reason_text:
    'River gauges above danger mark and satellite flood extent agree, all within 20 minutes',
  oldest_source_age_sec: 1200,
  conflict_flag: true,
  stale_flag: false,
  missing_sources: [],
  contributing_event_ids: [],
};

describe('dispatchMessage', () => {
  it('carries priority, confidence, reason, caution and a maps link', () => {
    const m = dispatchMessage(rec, 1, '2018-08-16T03:30:00Z');
    expect(m).toContain('16 Aug 09:00 IST');
    expect(m).toContain('PRIORITY #1: Bhagamandala (Madikeri taluka)');
    expect(m).toContain('Confidence HIGH 91/100 · oldest signal 20 min');
    expect(m).toContain('CAUTION: sources disagree');
    expect(m).toContain('https://maps.google.com/?q=12.38580,75.53330');
  });

  it('builds an sms: link the phone can open offline', () => {
    expect(smsHref('a b')).toMatch(/^sms:[?&]body=a%20b$/);
  });
});
