import {
  boolean,
  char,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Mirrors migrations/0001_init.sql. Shared by the edge API and (via SQL) the Python worker.

export const sources = pgTable('sources', {
  source_id: text('source_id').primaryKey(),
  display_name: text('display_name').notNull(),
  tier: char('tier', { length: 2 }).notNull(),
  refresh_seconds: integer('refresh_seconds').notNull(),
  last_success_at: timestamp('last_success_at', { withTimezone: true }),
  last_error_at: timestamp('last_error_at', { withTimezone: true }),
  last_error_msg: text('last_error_msg'),
});

/** Partitioned by day on observed_at; the primary key must include it. */
export const events = pgTable(
  'events',
  {
    id: uuid('id').notNull(),
    source_id: text('source_id').notNull(),
    source_tier: char('source_tier', { length: 2 }).notNull(),
    event_type: text('event_type').notNull(),
    grid_cell_id: text('grid_cell_id').notNull(),
    place_name: text('place_name'),
    taluka: text('taluka'),
    district: text('district').notNull().default('kodagu'),
    lat: doublePrecision('lat').notNull(),
    lon: doublePrecision('lon').notNull(),
    observed_at: timestamp('observed_at', { withTimezone: true, mode: 'string' }).notNull(),
    received_at: timestamp('received_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    raw_value: jsonb('raw_value').notNull(),
    normalized_value: doublePrecision('normalized_value'),
    confidence_hint: doublePrecision('confidence_hint'),
    polarity: smallint('polarity').notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.observed_at] }),
    index('events_cell_time').on(t.grid_cell_id, t.observed_at),
    index('events_type_time').on(t.event_type, t.observed_at),
    index('events_source_time').on(t.source_id, t.observed_at),
  ],
);

export const villageGeometries = pgTable('village_geometries', {
  village_id: text('village_id').primaryKey(),
  place_name: text('place_name').notNull(),
  taluka: text('taluka').notNull(),
  district: text('district').notNull(),
  centroid_lat: doublePrecision('centroid_lat').notNull(),
  centroid_lon: doublePrecision('centroid_lon').notNull(),
  geometry: jsonb('geometry').notNull(),
  population: integer('population'),
});

export const recommendations = pgTable(
  'recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    computed_at: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
    village_id: text('village_id'),
    grid_cell_id: text('grid_cell_id').notNull(),
    composite_score: doublePrecision('composite_score').notNull(),
    band: char('band', { length: 1 }).notNull(),
    reason_text: text('reason_text').notNull(),
    oldest_source_age_sec: integer('oldest_source_age_sec').notNull(),
    conflict_flag: boolean('conflict_flag').notNull().default(false),
    contributing_event_ids: uuid('contributing_event_ids').array().notNull(),
  },
  (t) => [index('recommendations_latest').on(t.computed_at, t.composite_score)],
);
