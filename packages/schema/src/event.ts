import { z } from 'zod';

export const SourceTier = z.enum(['T1', 'T2', 'T3', 'T4']);
export type SourceTier = z.infer<typeof SourceTier>;

export const EventType = z.enum([
  'flood_extent', // SAR + optical + GFM
  'heavy_rain', // OpenWeather + IMD
  'river_danger', // CWC + NWDP
  'road_impassable', // OSM Overpass derived
  'power_outage', // DISCOM
  'thermal_anomaly', // FIRMS
  'earthquake', // USGS
  'multi_hazard_alert', // GDACS
  'citizen_report', // SMS
]);
export type EventType = z.infer<typeof EventType>;

export const EventLocation = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  grid_cell_id: z.string(), // set by normalizer; "12.3400_75.6700_500m"
  place_name: z.string().nullable(),
  taluka: z.string().nullable(),
  district: z.literal('kodagu'),
});
export type EventLocation = z.infer<typeof EventLocation>;

export const RawEvent = z.object({
  id: z.string().uuid(),
  source_id: z.string(), // e.g. 'sentinel-1-cdse'
  source_tier: SourceTier,
  event_type: EventType,
  location: EventLocation,
  observed_at_utc: z.string().datetime(),
  received_at_utc: z.string().datetime(),
  raw_value: z.record(z.unknown()), // adapter-native payload
  normalized_value: z.number().nullable(), // e.g. flood probability 0-1
  confidence_hint: z.number().min(0).max(1).nullable(),
  // +1 = signal says hazard present, -1 = signal says all-clear ("safe" SMS).
  // Used to raise conflict flags; defaults to hazard.
  polarity: z.union([z.literal(1), z.literal(-1)]).default(1),
});
export type RawEvent = z.infer<typeof RawEvent>;
export type RawEventInput = z.input<typeof RawEvent>;
