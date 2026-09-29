-- ClearSignal initial schema (spec §8.3), with two corrections:
--   * events PK is (id, observed_at): Postgres requires unique constraints on a
--     partitioned table to include the partition key.
--   * events.polarity added (+1 hazard / -1 all-clear) for conflict detection.

CREATE TABLE IF NOT EXISTS sources (
  source_id       TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  tier            CHAR(2) NOT NULL CHECK (tier IN ('T1','T2','T3','T4')),
  refresh_seconds INT NOT NULL,
  last_success_at TIMESTAMPTZ,
  last_error_at   TIMESTAMPTZ,
  last_error_msg  TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id               UUID NOT NULL,
  source_id        TEXT NOT NULL REFERENCES sources(source_id),
  source_tier      CHAR(2) NOT NULL CHECK (source_tier IN ('T1','T2','T3','T4')),
  event_type       TEXT NOT NULL,
  grid_cell_id     TEXT NOT NULL,
  place_name       TEXT,
  taluka           TEXT,
  district         TEXT NOT NULL DEFAULT 'kodagu',
  lat              DOUBLE PRECISION NOT NULL,
  lon              DOUBLE PRECISION NOT NULL,
  observed_at      TIMESTAMPTZ NOT NULL,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_value        JSONB NOT NULL,
  normalized_value DOUBLE PRECISION,
  confidence_hint  DOUBLE PRECISION,
  polarity         SMALLINT NOT NULL DEFAULT 1 CHECK (polarity IN (-1, 1)),
  PRIMARY KEY (id, observed_at)
) PARTITION BY RANGE (observed_at);

-- Catch-all so an insert never fails if the scheduler misses a day.
CREATE TABLE IF NOT EXISTS events_default PARTITION OF events DEFAULT;

CREATE INDEX IF NOT EXISTS events_cell_time   ON events (grid_cell_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS events_type_time   ON events (event_type, observed_at DESC);
CREATE INDEX IF NOT EXISTS events_source_time ON events (source_id, observed_at DESC);

-- Daily partitions; the Python scheduler calls this one day ahead.
CREATE OR REPLACE FUNCTION ensure_event_partition(day DATE) RETURNS void AS $$
DECLARE
  part TEXT := format('events_%s', to_char(day, 'YYYYMMDD'));
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
    part, day::timestamptz, (day + 1)::timestamptz
  );
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS village_geometries (
  village_id   TEXT PRIMARY KEY,
  place_name   TEXT NOT NULL,
  taluka       TEXT NOT NULL,
  district     TEXT NOT NULL,
  centroid_lat DOUBLE PRECISION NOT NULL,
  centroid_lon DOUBLE PRECISION NOT NULL,
  geometry     JSONB NOT NULL,  -- GeoJSON; v1 seeds Points, polygons from OSM are roadmap
  population   INT
);

CREATE TABLE IF NOT EXISTS recommendations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  computed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  village_id             TEXT REFERENCES village_geometries(village_id),
  grid_cell_id           TEXT NOT NULL,
  composite_score        DOUBLE PRECISION NOT NULL,
  band                   CHAR(1) NOT NULL CHECK (band IN ('H','M','L')),
  reason_text            TEXT NOT NULL,
  oldest_source_age_sec  INT NOT NULL,
  conflict_flag          BOOLEAN NOT NULL DEFAULT FALSE,
  contributing_event_ids UUID[] NOT NULL
);

CREATE INDEX IF NOT EXISTS recommendations_latest ON recommendations (computed_at DESC, composite_score DESC);
