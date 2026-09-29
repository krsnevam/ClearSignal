/**
 * Generates the Kodagu August 2018 scenario fixtures (data/raw/*.json).
 *
 * HONESTY NOTE — read before citing these files as archival:
 *   • Daily rainfall totals and the landslide count (105) follow the published
 *     2018 record; individual landslide coordinates are *reconstructed* by
 *     scattering around documented affected villages, not copied from the GSI
 *     inventory. Replace with the GSI point file before claiming them as real.
 *   • Gauge levels, outage windows and satellite detections are reconstructed
 *     to match the documented timeline, not transcribed from bulletins.
 *   • All 24 SMS messages are synthetic and labelled as such.
 *
 * Deterministic: fixed RNG seed, so every run produces identical output (§12.5).
 * Run with `pnpm --filter @clearsignal/kodagu-fixtures generate`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VILLAGES } from './villages';

const SEED = 20180816;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'raw');

// mulberry32 — tiny deterministic PRNG
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const jitter = (spread: number) => (rand() - 0.5) * 2 * spread;

function uuid(): string {
  const h = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16));
  h[12] = '4';
  h[16] = ((Number.parseInt(h[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** Video slice starts at 09:00 IST on 16 Aug 2018 (§12.4) = 03:30 UTC. */
export const T0 = Date.parse('2018-08-16T03:30:00Z');
const at = (minutesFromT0: number) => new Date(T0 + minutesFromT0 * 60_000).toISOString();
const ist = (iso: string) => new Date(Date.parse(iso) + 330 * 60_000).toISOString().slice(0, 16);

function village(id: string) {
  const v = VILLAGES.find((x) => x.village_id === `kdg-${id}`);
  if (!v) throw new Error(`unknown village ${id}`);
  return v;
}
/** A point within `m` metres of a village centroid. */
function near(id: string, m = 400) {
  const v = village(id);
  const deg = m / 111_000;
  return { lat: +(v.lat + jitter(deg)).toFixed(5), lon: +(v.lon + jitter(deg)).toFixed(5) };
}

export interface RawFixture {
  id: string;
  source_id: string;
  event_type: string;
  observed_at_utc: string;
  lat: number;
  lon: number;
  polarity: 1 | -1;
  normalized_value: number | null;
  raw_value: Record<string, unknown>;
}

const files: Record<string, RawFixture[]> = {
  satellite: [],
  rainfall: [],
  gauges: [],
  landslides: [],
  outages: [],
  sms: [],
};

function push(
  file: keyof typeof files,
  f: Omit<RawFixture, 'id' | 'polarity'> & { polarity?: 1 | -1 },
) {
  files[file]?.push({ id: uuid(), polarity: 1, ...f });
}

// ── Satellite: Sentinel-1 passes + CEMS GFM daily product ──────────────────
const s1Passes = [
  { t: -22, cells: ['makkandur', 'mukkodlu', 'madenadu', 'kushalnagar'] }, // 03:08Z 16 Aug
  { t: 22 * 60 + 40, cells: ['makkandur', 'mukkodlu', 'kushalnagar', 'hattihole', 'bhagamandala'] },
];
for (const pass of s1Passes) {
  for (const c of pass.cells) {
    const p = +(0.72 + rand() * 0.25).toFixed(2);
    push('satellite', {
      source_id: 'sentinel-1-cdse',
      event_type: 'flood_extent',
      observed_at_utc: at(pass.t),
      ...near(c, 300),
      normalized_value: p,
      raw_value: {
        flood_probability: p,
        algorithm: 'dask-flood-mapper (TU Wien Bayesian)',
        orbit: 'descending',
        reconstructed: true,
      },
    });
  }
}
for (const [dayOffsetMin, cells] of [
  [-210, ['bhagamandala', 'makkandur', 'napoklu']],
  [-210 + 1440, ['bhagamandala', 'kushalnagar', 'mukkodlu']],
] as const) {
  for (const c of cells) {
    push('satellite', {
      source_id: 'cems-gfm',
      event_type: 'flood_extent',
      observed_at_utc: at(dayOffsetMin),
      ...near(c, 500),
      normalized_value: 1,
      raw_value: { product: 'GFM ensemble flood extent', reconstructed: true },
    });
  }
}

// ── Rainfall: IMD daily district totals, disaggregated to hourly readings ───
// District daily totals (mm) for 10–17 Aug 2018, per the IMD record for Kodagu.
const DAILY_MM: Record<string, number> = {
  '2018-08-10': 108,
  '2018-08-11': 96,
  '2018-08-12': 131,
  '2018-08-13': 152,
  '2018-08-14': 214,
  '2018-08-15': 288,
  '2018-08-16': 322,
  '2018-08-17': 176,
};
files.rainfall?.push(
  ...Object.entries(DAILY_MM).map(([day, mm]) => ({
    id: uuid(),
    source_id: 'imd',
    event_type: 'heavy_rain',
    observed_at_utc: `${day}T03:00:00.000Z`, // 08:30 IST bulletin
    ...near('madikeri', 50),
    polarity: 1 as const,
    normalized_value: mm,
    raw_value: {
      kind: 'district_daily_total_mm',
      district_total_mm: mm,
      bulletin: `${day} 08:30 IST`,
    },
  })),
);
// Hourly OpenWeather rain-rate at taluka stations across the 36 h around T0.
// Only readings above 25 mm/h become heavy_rain events (§7.2).
const rainStations = ['bhagamandala', 'madikeri', 'napoklu', 'somwarpet', 'virajpet', 'makkandur'];
for (let h = -18; h <= 18; h++) {
  for (const s of rainStations) {
    const peak = s === 'bhagamandala' ? 38 : s === 'makkandur' || s === 'madikeri' ? 31 : 22;
    const diurnal = 0.75 + 0.25 * Math.cos(((h - 2) / 12) * Math.PI);
    const mmh = +(peak * diurnal + jitter(6)).toFixed(1);
    if (mmh <= 25) continue;
    push('rainfall', {
      source_id: 'openweather',
      event_type: 'heavy_rain',
      observed_at_utc: at(h * 60 - 4),
      ...near(s, 200),
      normalized_value: mmh,
      raw_value: { rain_1h_mm: mmh, endpoint: 'onecall/3.0 current', reconstructed: true },
    });
  }
}
// IMD nowcast warnings every 3 h for the worst-hit stations
for (let h = -12; h <= 12; h += 3) {
  for (const s of ['bhagamandala', 'madikeri']) {
    push('rainfall', {
      source_id: 'imd',
      event_type: 'heavy_rain',
      observed_at_utc: at(h * 60 - 7),
      ...near(s, 100),
      normalized_value: 3,
      raw_value: {
        kind: 'nowcast',
        warning_level: 'red',
        text: 'Intense spell of rain likely',
        reconstructed: true,
      },
    });
  }
}

// ── River gauges: CWC (daily bulletin, 4 stations) + hourly telemetry at two ─
const gaugeStations = [
  { id: 'bhagamandala', name: 'Bhagamandala (Triveni Sangama)', danger: 6.5 },
  { id: 'napoklu', name: 'Napoklu', danger: 7.2 },
  { id: 'kushalnagar', name: 'Kushalnagar (Kaveri)', danger: 8.0 },
  { id: 'siddapur', name: 'Siddapur', danger: 5.5 },
];
for (let day = 0; day < 8; day++) {
  for (const g of gaugeStations) {
    const rise = day / 7;
    const level = +(g.danger * (0.6 + 0.6 * rise) + jitter(0.3)).toFixed(2);
    const t = new Date(Date.parse('2018-08-10T03:00:00Z') + day * 86_400_000).toISOString();
    if (level <= g.danger) continue; // only above-danger readings are events
    push('gauges', {
      source_id: 'cwc-wris',
      event_type: 'river_danger',
      observed_at_utc: t,
      ...near(g.id, 100),
      normalized_value: +(level / g.danger).toFixed(3),
      raw_value: { station: g.name, level_m: level, danger_m: g.danger, kind: 'daily_bulletin' },
    });
  }
}
for (let h = -4; h <= 4; h++) {
  const b = gaugeStations[0];
  const k = gaugeStations[2];
  if (!b || !k) throw new Error('gauge stations');
  const bl = +(b.danger + 1.1 + h * 0.08 + jitter(0.05)).toFixed(2);
  push('gauges', {
    source_id: 'cwc-wris',
    event_type: 'river_danger',
    observed_at_utc: at(h * 60 - 15),
    ...near('bhagamandala', 100),
    normalized_value: +(bl / b.danger).toFixed(3),
    raw_value: { station: b.name, level_m: bl, danger_m: b.danger, kind: 'hourly_telemetry' },
  });
  push('gauges', {
    source_id: 'nwdp',
    event_type: 'river_danger',
    observed_at_utc: at(h * 60 - 20),
    ...near('bhagamandala', 150),
    normalized_value: +(bl / b.danger).toFixed(3),
    raw_value: {
      station: `${b.name} (NWDP)`,
      level_m: bl,
      danger_m: b.danger,
      kind: 'hourly_telemetry',
    },
  });
  // Kaveri at Kushalnagar crosses danger mid-slice
  const kl = +(k.danger - 0.6 + (h + 4) * 0.22 + jitter(0.05)).toFixed(2);
  if (kl > k.danger) {
    push('gauges', {
      source_id: 'cwc-wris',
      event_type: 'river_danger',
      observed_at_utc: at(h * 60 - 10),
      ...near('kushalnagar', 100),
      normalized_value: +(kl / k.danger).toFixed(3),
      raw_value: { station: k.name, level_m: kl, danger_m: k.danger, kind: 'hourly_telemetry' },
    });
  }
}

// ── Landslides: 105 across 10–17 Aug, surfaced as road closures (§12.2) ────
// Weighted towards the documented worst-hit belt around Madikeri.
const slideBelt: [string, number][] = [
  ['makkandur', 16],
  ['mukkodlu', 12],
  ['hattihole', 14],
  ['jodupala', 12],
  ['madenadu', 11],
  ['galibeedu', 9],
  ['monnangeri', 9],
  ['kalur', 8],
  ['sampaje', 6],
  ['talakaveri', 5],
  ['somwarpet', 3],
];
const dayWeights = [2, 2, 4, 6, 12, 22, 30, 23]; // 10–17 Aug; + 4 scripted below = 105
let slideIdx = 0;
const beltPool = slideBelt.flatMap(([v, n]) => Array<string>(n).fill(v));
for (let day = 0; day < 8; day++) {
  for (let i = 0; i < (dayWeights[day] ?? 0); i++) {
    const v = beltPool[Math.floor(rand() * beltPool.length)] ?? 'makkandur';
    const t = new Date(
      Date.parse('2018-08-09T18:30:00Z') + day * 86_400_000 + Math.floor(rand() * 86_400_000),
    ).toISOString();
    push('landslides', {
      source_id: 'overpass',
      event_type: 'road_impassable',
      observed_at_utc: t,
      ...near(v, 2200),
      normalized_value: 1,
      raw_value: {
        cause: 'landslide',
        ref: `KDG-LS-2018-${String(++slideIdx).padStart(3, '0')}`,
        reconstructed: true,
      },
    });
  }
}
// Scripted closures in the video slice
for (const [v, t, road] of [
  ['makkandur', 35, 'Makkandur–Madikeri road'],
  ['hattihole', -50, 'Hattihole–Madapura road'],
  ['hattihole', 25, 'Hattihole bridge approach'],
  ['jodupala', -90, 'NH-275 at Jodupala'],
] as const) {
  push('landslides', {
    source_id: 'overpass',
    event_type: 'road_impassable',
    observed_at_utc: at(t),
    ...near(v, 600),
    normalized_value: 1,
    raw_value: {
      cause: 'landslide',
      road,
      ref: `KDG-LS-2018-${String(++slideIdx).padStart(3, '0')}`,
      reconstructed: true,
    },
  });
}

// ── Power outages: 18 windows, 14–17 Aug ───────────────────────────────────
const outage = (v: string, t: number, feeder: string) =>
  push('outages', {
    source_id: 'discom-outage',
    event_type: 'power_outage',
    observed_at_utc: at(t),
    ...near(v, 500),
    normalized_value: 1,
    raw_value: {
      feeder,
      provider: 'CESC (Chamundeshwari)',
      kind: 'outage_start',
      reconstructed: true,
    },
  });
outage('makkandur', -8, 'Makkandur 11kV');
outage('makkandur', -11, 'Makkandur–Hebbettageri 11kV');
outage('makkandur', 30, 'Makkandur 11kV');
outage('makkandur', 95, 'Makkandur 11kV');
outage('mukkodlu', -30, 'Mukkodlu 11kV');
outage('galibeedu', -40, 'Galibeedu 11kV');
for (const [v, t] of [
  ['madikeri', -2400],
  ['somwarpet', -2100],
  ['napoklu', -1800],
  ['sampaje', -1500],
  ['kalur', -1300],
  ['jodupala', -1000],
  ['madenadu', -800],
  ['hattihole', -600],
  ['monnangeri', -420],
  ['talakaveri', -300],
  ['bhagamandala', 140],
  ['kushalnagar', 160],
] as const) {
  outage(v, t, `${village(v).place_name} 11kV`);
}

// ── SMS: 24 synthetic citizen reports (PII already stripped) ───────────────
const sms = (v: string, t: number, body: string, polarity: 1 | -1 = 1) =>
  push('sms', {
    source_id: 'twilio-sms',
    event_type: 'citizen_report',
    observed_at_utc: at(t),
    ...near(v, 300),
    polarity,
    normalized_value: null,
    raw_value: {
      body,
      synthetic: true,
      from_hash: `sha256:${uuid().replace(/-/g, '').slice(0, 16)}`,
    },
  });
// Village A mirror at T0: 4 reports 5–19 min old
sms('makkandur', -5, 'water entering houses near makkandur school, need boat');
sms('makkandur', -12, 'Makkandur road gone, 30 people on temple hill');
sms('makkandur', -17, 'flood makkandur elderly stuck');
sms('makkandur', -19, 'makkandur hillside cracking, houses flooded');
sms('makkandur', 20, 'makkandur still flooding, no power');
sms('makkandur', 55, 'makkandur need medicine, 2 injured');
sms('makkandur', 110, 'makkandur water rising again');
sms('bhagamandala', -9, 'Bhagamandala bus stand under water');
sms('bhagamandala', -3, 'triveni sangama overflowing into shops bhagamandala');
sms('mukkodlu', -10, 'mukkodlu water gone down we are safe', -1);
sms('mukkodlu', 70, 'mukkodlu safe, road open to madikeri', -1);
sms('hattihole', 15, 'hattihole landslide 3 houses gone');
sms('jodupala', -80, 'jodupala bridge cut off, families on hill');
sms('galibeedu', -60, 'galibeedu stream flooding fields');
sms('ponnampet', -180, 'ponnampet water near river houses'); // Village B mirror: lone, 3 h old
sms('napoklu', 40, 'napoklu low areas flooding');
// Earlier, 15 Aug
sms('madenadu', -1320, 'madenadu landslide near school');
sms('monnangeri', -1200, 'monnangeri road blocked by mud');
sms('kalur', -1100, 'kalur families moved to relief camp');
sms('sampaje', -900, 'sampaje ghat closed trucks stuck');
sms('talakaveri', -850, 'talakaveri heavy rain slope sliding');
sms('madikeri', -700, 'madikeri market area waterlogged');
sms('somwarpet', -640, 'somwarpet trees down on road');
sms('hattihole', -560, 'hattihole no network since morning');

mkdirSync(OUT, { recursive: true });
for (const [name, rows] of Object.entries(files)) {
  rows.sort((a, b) => a.observed_at_utc.localeCompare(b.observed_at_utc));
  writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify(rows, null, 2)}\n`);
  console.log(
    `${name.padEnd(11)} ${String(rows.length).padStart(3)}  ${ist(rows[0]?.observed_at_utc ?? '')} → ${ist(rows.at(-1)?.observed_at_utc ?? '')} IST`,
  );
}
