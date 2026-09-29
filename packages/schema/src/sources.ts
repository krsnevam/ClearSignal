import type { SourceTier } from './event';

/**
 * Source registry. Tiers are fixed here at configuration time and cannot be
 * changed at runtime — a malfunctioning feed cannot promote itself (§3.3).
 */
export interface SourceDef {
  source_id: string;
  display_name: string;
  short_label: string; // used in plain-English explanations
  tier: SourceTier;
  refresh_interval_seconds: number;
}

export const SOURCES = [
  {
    source_id: 'cwc-wris',
    display_name: 'CWC river gauges (India-WRIS)',
    short_label: 'CWC gauge',
    tier: 'T1',
    refresh_interval_seconds: 3600,
  },
  {
    source_id: 'nwdp',
    display_name: 'National Water Data Portal',
    short_label: 'NWDP gauge',
    tier: 'T1',
    refresh_interval_seconds: 3600,
  },
  {
    source_id: 'usgs-quake',
    display_name: 'USGS earthquake feed',
    short_label: 'USGS',
    tier: 'T1',
    refresh_interval_seconds: 300,
  },
  {
    source_id: 'sentinel-1-cdse',
    display_name: 'Sentinel-1 SAR flood extent',
    short_label: 'satellite radar',
    tier: 'T2',
    refresh_interval_seconds: 21600,
  },
  {
    source_id: 'sentinel-2-cdse',
    display_name: 'Sentinel-2 optical',
    short_label: 'satellite optical',
    tier: 'T2',
    refresh_interval_seconds: 43200,
  },
  {
    source_id: 'cems-gfm',
    display_name: 'Copernicus EMS Global Flood Monitoring',
    short_label: 'Copernicus GFM',
    tier: 'T2',
    refresh_interval_seconds: 86400,
  },
  {
    source_id: 'firms-nasa',
    display_name: 'NASA FIRMS thermal anomalies',
    short_label: 'NASA FIRMS',
    tier: 'T2',
    refresh_interval_seconds: 10800,
  },
  {
    source_id: 'openweather',
    display_name: 'OpenWeather One Call 3.0',
    short_label: 'OpenWeather',
    tier: 'T3',
    refresh_interval_seconds: 600,
  },
  {
    source_id: 'imd',
    display_name: 'IMD nowcasts & warnings',
    short_label: 'IMD',
    tier: 'T3',
    refresh_interval_seconds: 900,
  },
  {
    source_id: 'overpass',
    display_name: 'OSM road status (Overpass)',
    short_label: 'road status',
    tier: 'T3',
    refresh_interval_seconds: 21600,
  },
  {
    source_id: 'gdacs',
    display_name: 'GDACS multi-hazard alerts',
    short_label: 'GDACS',
    tier: 'T3',
    refresh_interval_seconds: 300,
  },
  {
    source_id: 'twilio-sms',
    display_name: 'Citizen SMS (Twilio)',
    short_label: 'SMS',
    tier: 'T4',
    refresh_interval_seconds: 0,
  },
  {
    source_id: 'msg91-sms',
    display_name: 'Citizen SMS (MSG91, India)',
    short_label: 'SMS',
    tier: 'T4',
    refresh_interval_seconds: 0,
  },
  {
    source_id: 'discom-outage',
    display_name: 'DISCOM power outages (mock adapter)',
    short_label: 'power outage',
    tier: 'T4',
    refresh_interval_seconds: 3600,
  },
] as const satisfies readonly SourceDef[];

export type SourceId = (typeof SOURCES)[number]['source_id'];

export const SOURCE_BY_ID: Record<string, SourceDef> = Object.fromEntries(
  SOURCES.map((s) => [s.source_id, s]),
);

export function tierOf(sourceId: string): SourceTier {
  const def = SOURCE_BY_ID[sourceId];
  if (!def) throw new Error(`Unknown source_id: ${sourceId}`);
  return def.tier;
}
