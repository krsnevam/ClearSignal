/**
 * Compiles data/raw/*.json into normalized RawEvents (data/events.json) using
 * the same Normalize stage the live pipeline uses.
 * Run with `pnpm --filter @clearsignal/kodagu-fixtures build`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dedupe, normalizeEvent } from '@clearsignal/fusion/normalize';
import { type RawEvent, tierOf } from '@clearsignal/schema';
import type { RawFixture } from './generate';
import { VILLAGES } from './villages';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

// Typical source → ClearSignal ingest lag, so received_at is realistic.
const LAG_S: Record<string, number> = {
  'sentinel-1-cdse': 45 * 60,
  'cems-gfm': 3 * 3600,
  openweather: 30,
  imd: 5 * 60,
  'cwc-wris': 10 * 60,
  nwdp: 5 * 60,
  overpass: 20 * 60,
  'discom-outage': 15 * 60,
  'twilio-sms': 2,
};

const events: RawEvent[] = [];
for (const file of readdirSync(join(DATA, 'raw')).sort()) {
  const rows = JSON.parse(readFileSync(join(DATA, 'raw', file), 'utf8')) as RawFixture[];
  for (const r of rows) {
    const received = new Date(Date.parse(r.observed_at_utc) + (LAG_S[r.source_id] ?? 60) * 1000);
    events.push(
      normalizeEvent(
        {
          id: r.id,
          source_id: r.source_id,
          source_tier: tierOf(r.source_id),
          event_type: r.event_type as RawEvent['event_type'],
          location: {
            lat: r.lat,
            lon: r.lon,
            grid_cell_id: '',
            place_name: null,
            taluka: null,
            district: 'kodagu',
          },
          observed_at_utc: r.observed_at_utc,
          received_at_utc: received.toISOString(),
          raw_value: { ...r.raw_value, fixture: file },
          normalized_value: r.normalized_value,
          confidence_hint: null,
          polarity: r.polarity,
        },
        VILLAGES,
      ),
    );
  }
}

const out = dedupe(events).sort((a, b) => a.observed_at_utc.localeCompare(b.observed_at_utc));
writeFileSync(join(DATA, 'events.json'), `${JSON.stringify(out)}\n`);
console.log(
  `events.json: ${out.length} normalized events (${events.length - out.length} deduplicated)`,
);
