/**
 * Applies migrations and seeds Neon: source registry, Kodagu villages, and —
 * with --with-replay — the 2018 fixture events (use on the replay-scenario branch only).
 * Run: node --import tsx --import ./scripts/register-yaml.mjs scripts/seed-kodagu.ts [--with-replay]
 */
import { readFileSync } from 'node:fs';
import { KODAGU_2018_EVENTS, VILLAGES } from '@clearsignal/kodagu-fixtures';
import { SOURCES } from '@clearsignal/schema';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL not set');
const pool = new Pool({ connectionString: url });

const migration = readFileSync(
  new URL('../packages/db-schema/migrations/0001_init.sql', import.meta.url),
  'utf8',
);
await pool.query(migration);
console.log('migrations applied');

for (const s of SOURCES) {
  await pool.query(
    `INSERT INTO sources (source_id, display_name, tier, refresh_seconds) VALUES ($1,$2,$3,$4)
     ON CONFLICT (source_id) DO UPDATE SET display_name = EXCLUDED.display_name, tier = EXCLUDED.tier, refresh_seconds = EXCLUDED.refresh_seconds`,
    [s.source_id, s.display_name, s.tier, s.refresh_interval_seconds],
  );
}
for (const v of VILLAGES) {
  await pool.query(
    `INSERT INTO village_geometries (village_id, place_name, taluka, district, centroid_lat, centroid_lon, geometry, population)
     VALUES ($1,$2,$3,'kodagu',$4,$5,$6,$7) ON CONFLICT (village_id) DO NOTHING`,
    [
      v.village_id,
      v.place_name,
      v.taluka,
      v.lat,
      v.lon,
      JSON.stringify({ type: 'Point', coordinates: [v.lon, v.lat] }),
      v.population ?? null,
    ],
  );
}
console.log(`seeded ${SOURCES.length} sources, ${VILLAGES.length} villages`);

if (process.argv.includes('--with-replay')) {
  for (const e of KODAGU_2018_EVENTS) {
    await pool.query(
      `INSERT INTO events (id, source_id, source_tier, event_type, grid_cell_id, place_name, taluka, district, lat, lon,
         observed_at, received_at, raw_value, normalized_value, confidence_hint, polarity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'kodagu',$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT DO NOTHING`,
      [
        e.id,
        e.source_id,
        e.source_tier,
        e.event_type,
        e.location.grid_cell_id,
        e.location.place_name,
        e.location.taluka,
        e.location.lat,
        e.location.lon,
        e.observed_at_utc,
        e.received_at_utc,
        JSON.stringify(e.raw_value),
        e.normalized_value,
        e.confidence_hint,
        e.polarity,
      ],
    );
  }
  console.log(`seeded ${KODAGU_2018_EVENTS.length} replay events`);
}
await pool.end();
