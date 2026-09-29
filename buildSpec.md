# ClearSignal — Build Spec

**Codename:** ClearSignal
**IEEE submission:** [#5391 — Turning Conflicting Signals Into Trusted Action](https://ideas-portal.ieee.org/subdomain/ieee-response-quest/end/node/5391)
**Stage:** Impact Challenge Product Submission (5/10)
**Target deliverable:** installable PWA + 3-minute product video + supporting documents package
**Build window:** 10 days (7 aggressive + 3 buffer)
**Author:** Subramanya Navada KR
**Version:** v1.0 · 2026-09-26

---

## 0. How to use this document

This spec exists so a small team — or a division of AI coding agents — can build ClearSignal end-to-end in ten days without stopping to make architecture decisions. Every "which library / which host / which schema" question has been pre-decided in `§4 Tech stack` and `§7-§15` fill in the mechanics. If you are unsure, do exactly what this document says and revisit later. Scope discipline is the whole game.

Sections are ordered by build sequence, not by importance. `§1 Winning strategy` and `§16 Demo video storyboard` are the two you should read on Day 0 before writing a line of code — everything else is downstream of them.

The document is organized so that any single AI agent can be handed one section as a self-contained brief. Owners are named per stream in `§18 Day-by-day plan`.

---

## 1. Winning strategy

### 1.1 The five judged criteria, decoded

| # | Criterion (as scored on IEEE portal) | What reviewers actually look for | Our score angle |
|---|---|---|---|
| 1 | Timeliness, Real-Time Responsiveness & Technical Reliability | Does it respond fast enough to matter in a live event? What breaks and how do you handle it? | Per-source latency numbers visible in UI; three named failure modes each with mitigation |
| 2 | Comprehensiveness, Use of Available Data & Novel Data Discovery | Are you using more than one channel? Anything the field hasn't tried? | Six live source classes + citizen SMS from feature phones (the novel channel) |
| 3 | Integration, Synthesis Quality & Responsible Data Handling | Do the signals *combine* into a decision, or just co-display? PII, transparency, weights auditable? | Six-stage pipeline (Ingest→Normalize→Store→Fuse→Rank→Explain); auditable weights YAML |
| 4 | Usability, Clarity & Operational Readiness for Emergency Responders | Would a stressed non-analyst actually use this on a bad day? | 60-second first-recommendation target; 90-second comprehension drill result |
| 5 | Scenario Fit, Insightfulness, Innovation & Technical/Data Creativity | Is the reframe genuinely new? Does it match the disaster it claims to serve? | Kodagu 2018 as documented, repeating failure; decision-triage-under-uncertainty reframe |

### 1.2 Reviewer profile

From the accepted-idea PDF, the Exposure Review Team is:

- Ashok Sivathapandian — Information Technology
- Ahsaki Benion — Legal and Compliance
- Jeanne Fahrenbach — Finance and Administration
- Prakash Satiani — Finance and Administration
- John D. DeSimone — Finance and Administration
- Karyn Connor — Finance and Administration
- Arash Nemati Hayati — Information Technology

**Consequence:** 5 of 7 reviewers are non-engineers. Weight the video toward **scenario clarity, decision impact, cost-effectiveness, and responsible-data handling**. Keep the confidence-engine math to one slide with a plain-English gloss. Do NOT open with architecture.

### 1.3 The three moments that win the video

1. **The one text.** During the demo, a Nokia feature phone (borrow one) is on-camera. It sends an SMS to the ClearSignal number. The recommendation card on the PWA updates in less than 4 seconds. Judges cannot fake this in their heads. This single shot is worth more than any diagram.
2. **Airplane mode.** Flip airplane mode on. The staleness banner appears. The ranked list still renders from cache. Flip it back. The sync spine reconciles. This proves offline-first is not a slide claim.
3. **Village A vs Village B.** The exact worked example from the submission plays out on screen with real component numbers. Score: 87, High. Score: 17, Low. This proves the confidence engine is a real function, not a marketing formula.

Every other beat of the video is in service of these three. See `§16 Demo video storyboard`.

### 1.4 Scope discipline (non-negotiable)

**We build:** one district (Kodagu), one persona (SDMA field coordinator), one disaster class (flash flood + landslide), one primary screen, one confidence formula. Nothing else.

**We do NOT build:**
- User accounts, auth, roles
- Command-center / desktop dashboard
- Multi-district scale
- Push notifications
- Admin console (weights YAML edited via file, not UI)
- ML/AI models beyond the linear confidence formula
- Multilingual UI beyond English + a Kannada glossary sheet
- Any "future" feature

Every scope creep during the sprint gets deleted immediately or moved to `§20 Risk log` as "roadmap".

---

## 2. Product vision

### 2.1 The single question

> "Which villages need evacuation support first, and how much should I trust that answer?"

### 2.2 The answer, in three seconds

A ranked list of locations, each with:

- **Confidence badge** — High (≥70) / Medium (40–69) / Low (<40)
- **Plain-English reason** — e.g. *"Satellite flood extent, two power-outage pings, and four SMS reports agree, all within 28 minutes"*
- **Source age** — of the oldest contributing source
- **Conflict flag** — when two sources disagree
- **Map pin** — with taluka and coordinates

### 2.3 The design constraint

A Karnataka SDMA field officer, trained but not a data analyst, on a mid-range Android handset (Samsung Galaxy A-series, 4 GB RAM) with degrading connectivity, must act on the top recommendation within 60 seconds of opening the app for the first time.

Every UI decision, every latency budget, every text label defers to this sentence.

---

## 3. System architecture

### 3.1 The one-screen picture

```
┌──────────────────────────────────────────────────────────────┐
│  PHONE (PWA)                                                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  React 19 + MapLibre GL + deck.gl overlay              │  │
│  │  Service worker (Workbox 8) · Dexie 4 hot cache        │  │
│  │  libSQL/Turso Sync spine · PMTiles offline basemap     │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────┬─────────────────────────────────────────────────┘
             │  HTTPS (only when online)
┌────────────▼─────────────────────────────────────────────────┐
│  EDGE API (Cloudflare Workers · Mumbai POP)                  │
│  Hono on Bun · type-safe with Zod · sub-100ms                │
│    GET  /rankings?district=kodagu                            │
│    GET  /recommendation/:id                                  │
│    POST /sms-webhook  (Twilio + MSG91)                       │
│    GET  /sources/status                                      │
└────────────┬─────────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────────┐
│  DATA & COMPUTE                                              │
│                                                              │
│  Neon Postgres (Mumbai)      Turso libSQL cloud              │
│    events, sources             mirrored slice for phones     │
│    village_geometries                                        │
│                                                              │
│  Fly.io Mumbai worker (Python)                               │
│    Sentinel-1 SAR ingest (dask-flood-mapper, TU Wien)        │
│    Sentinel-2 optical ingest                                 │
│    Scenario replayer (Kodagu Aug 2018 archive, 60× speed)    │
└────────────┬─────────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────────┐
│  EXTERNAL SOURCES                                            │
│  Copernicus Data Space Ecosystem (STAC + Process API)        │
│  CEMS Global Flood Monitoring (openEO)                       │
│  OpenWeather One Call 3.0 · IMD Public APIs                  │
│  CWC WRIS (india-water-data client) · NWDP hourly            │
│  OSM Overpass API · NASA FIRMS                               │
│  GDACS · USGS Earthquake GeoJSON                             │
│  Twilio Programmable Messaging · MSG91 India inbound         │
│  DISCOM outage aggregators (geoblackout.com scrape)          │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 The six pipeline stages

Every event that enters ClearSignal passes through the same six stages, named for the judged Integration criterion:

1. **Ingest** — adapter converts a source's native payload into the common `RawEvent` schema.
2. **Normalize** — timestamps → UTC, coordinates → EPSG:4326, locations snap to 500 m grid, duplicates within a 5-minute window deduplicated.
3. **Store** — write to Neon (durable) and to Turso (mobile-syncable slice). Dexie caches the hot 24-hour window on the phone.
4. **Fuse** — compute `recency_score`, `agreement_score`, `reliability_score` per candidate location.
5. **Rank** — apply the linear formula, sort by composite score, produce ranked list.
6. **Explain** — build the plain-English reason from the top three contributing signals, note conflicts, mark source ages.

### 3.3 Reliability tiers

Each source is assigned a tier at *configuration time* and cannot be modified at runtime. This is a security property (a malfunctioning feed cannot promote itself) and a judged criterion.

| Tier | Description | Sources |
|---|---|---|
| **T1** | Calibrated in-situ sensors, official telemetry | CWC river gauges, USGS earthquake ShakeMap |
| **T2** | Satellite-derived, agency-validated | Sentinel-1 SAR flood extent, CEMS GFM, Sentinel-2 optical, NASA FIRMS |
| **T3** | Verified partner reports, third-party open data | OpenWeather One Call, IMD, GDACS, OSM road status |
| **T4** | Citizen ground truth | Twilio SMS ingest, MSG91 SMS ingest, DISCOM outage aggregators |

The tier is baked into the adapter code. Weights come from `config/weights.yaml` (see `§9 Fusion engine`).

---

## 4. Tech stack (final, versioned)

### 4.1 Frontend

```
runtime           : browser (Android 8+, iOS 14+)
framework         : React 19.0
build             : Vite 6
pwa               : vite-plugin-pwa 0.20 (Workbox 8)
maps              : maplibre-gl 5.0
map overlay       : deck.gl 9
basemap           : Protomaps PMTiles, Kodagu clip, ~80MB, z0-z16
storage (hot)     : dexie 4.0 (IndexedDB)
storage (sync)    : @tursodatabase/database + @tursodatabase/sync
styling           : tailwindcss 4
state             : zustand 5 (deliberately small; no Redux)
routing           : none (single-screen app; use tabs component)
type validation   : zod 3
i18n              : none; english + kannada glossary in supporting docs
```

### 4.2 Backend (edge)

```
runtime           : Bun 1.2 (workers) or Node.js 22 (fallback)
framework         : Hono 4
host              : Cloudflare Workers (Mumbai POP)
schema            : zod 3, shared with frontend via workspace package
sms               : twilio 5 sdk (primary), msg91 fetch adapter (india path)
```

### 4.3 Backend (long jobs)

```
runtime           : Python 3.12 on Fly.io Mumbai
sar               : dask-flood-mapper 1.x (interTwin, TU Wien Bayesian)
stac              : pystac-client 0.8, odc-stac 0.4
weather adapters  : httpx 0.27 + tenacity 9 (retries)
scheduler         : apscheduler 3 (cron-like; simple)
```

### 4.4 Data layer

```
durable postgres  : Neon (Mumbai region), 1 project, 3 branches
                    (main, staging, replay-scenario)
timeseries        : Postgres 16 native partitioning by day; no extensions
mobile sync       : Turso libSQL, embedded on device + cloud replica
migrations        : drizzle-kit 0.30
orm (edge)        : drizzle 0.36
orm (worker)      : drizzle 0.36 (same schema)
python data       : SQLAlchemy 2 for the Python worker's writes
```

### 4.5 External data sources

| Source | Endpoint | Auth | Tier | Refresh |
|---|---|---|---|---|
| Sentinel-1 SAR | Copernicus Data Space STAC | free registration | T2 | 6–12 h revisit |
| Sentinel-2 optical | Copernicus Data Space STAC | free registration | T2 | 5-day revisit |
| CEMS Global Flood Monitoring | openEO Platform | free registration | T2 | daily |
| NASA FIRMS | firms.modaps.eosdis.nasa.gov | free API key | T2 | ~3 h |
| OpenWeather One Call 3.0 | api.openweathermap.org | paid key (~$0/1k calls tier) | T3 | 10 min |
| IMD Public APIs | api.imd.gov.in | free registration | T3 | 15–60 min |
| CWC WRIS | via `india-water-data` client | free | T1 | hourly |
| National Water Data Portal | nwdp.nwic.gov.in | free | T1 | hourly |
| OSM Overpass | overpass-api.de | rate-limited free | T3 | on demand |
| GDACS | gdacs.org GeoJSON | free | T3 | ~5 min |
| USGS Earthquake | earthquake.usgs.gov feed | free | T1 | ~5 min |
| Twilio SMS | api.twilio.com | trial credit | T4 | inbound webhook |
| MSG91 SMS | control.msg91.com | paid (India-native) | T4 | inbound webhook |
| DISCOM outages | scrape of geoblackout / powercut.today | none | T4 | hourly |

### 4.6 Dev tooling

```
package manager   : pnpm 9 (monorepo workspaces)
linter/formatter  : biome 2 (replaces eslint + prettier)
test runner       : vitest 2 (frontend) · bun test (edge) · pytest 8 (python)
type-check ci     : tsc --noEmit on every PR
ci                : github actions
```

### 4.7 AI workforce assignments

| Tool | Primary role |
|---|---|
| **Claude Code** | Backend adapters, fusion engine, Neon schema, Twilio webhook, deployment scripts |
| **Cursor** | UI polish pass, tests, refactors, the last 10% |
| **v0.dev** | One-shot React component seeds for primary screen and recommendation card |
| **Bolt.new** | Scenario replayer scaffold, Python worker skeleton |
| **Windsurf** | Reserve — engage if any of the above stalls on a multi-file refactor |

---

## 5. Repository structure

Monorepo, pnpm workspaces. One repo, one CI, one deploy config.

```
clearsignal/
├── apps/
│   ├── web/                 # PWA (Vite + React 19)
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   │   ├── Primary.tsx           # the one screen
│   │   │   │   └── RecommendationDetail.tsx
│   │   │   ├── components/
│   │   │   │   ├── RankedList.tsx
│   │   │   │   ├── RecommendationCard.tsx
│   │   │   │   ├── ConfidenceBadge.tsx
│   │   │   │   ├── ConflictFlag.tsx
│   │   │   │   ├── SourceAge.tsx
│   │   │   │   ├── OfflineBanner.tsx
│   │   │   │   └── StalenessBanner.tsx
│   │   │   ├── map/
│   │   │   │   ├── MapView.tsx           # MapLibre + deck.gl
│   │   │   │   ├── pmtiles.ts            # PMTiles protocol registration
│   │   │   │   └── style.json            # basemap style
│   │   │   ├── storage/
│   │   │   │   ├── dexie.ts              # hot cache schema
│   │   │   │   ├── turso.ts              # sync spine
│   │   │   │   └── sync.ts               # push/pull loop
│   │   │   ├── fusion/
│   │   │   │   ├── engine.ts             # runs on device too
│   │   │   │   └── weights.yaml
│   │   │   ├── api.ts                    # typed client (hono/client)
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── public/
│   │   │   ├── kodagu.pmtiles            # PMTiles clip, ~80MB
│   │   │   ├── manifest.webmanifest
│   │   │   └── icons/*
│   │   └── vite.config.ts
│   │
│   └── edge/                # Cloudflare Workers API
│       ├── src/
│       │   ├── routes/
│       │   │   ├── rankings.ts
│       │   │   ├── recommendation.ts
│       │   │   ├── sms-webhook.ts
│       │   │   └── sources-status.ts
│       │   ├── fusion/
│       │   │   └── engine.ts             # shared logic with web
│       │   ├── db/
│       │   │   └── neon.ts               # drizzle client
│       │   └── index.ts
│       └── wrangler.toml
│
├── workers/
│   └── python/              # Fly.io Python worker
│       ├── adapters/
│       │   ├── sentinel1.py
│       │   ├── sentinel2.py
│       │   ├── cems_gfm.py
│       │   ├── firms.py
│       │   ├── openweather.py
│       │   ├── imd.py
│       │   ├── cwc_wris.py
│       │   ├── nwdp.py
│       │   ├── overpass.py
│       │   ├── gdacs.py
│       │   ├── usgs_quake.py
│       │   └── discom_scrape.py
│       ├── replayer/
│       │   ├── kodagu_2018.py
│       │   └── clock.py                  # 60× time compression
│       ├── db.py
│       ├── scheduler.py
│       ├── pyproject.toml
│       └── fly.toml
│
├── packages/
│   ├── schema/              # zod contracts shared across web/edge
│   │   ├── src/
│   │   │   ├── event.ts
│   │   │   ├── recommendation.ts
│   │   │   ├── ranking.ts
│   │   │   └── weights.ts
│   │   └── package.json
│   ├── db-schema/           # drizzle schema shared across edge + workers
│   │   └── src/schema.ts
│   └── kodagu-fixtures/     # 2018 event archive as JSON
│       ├── landslides.json
│       ├── rainfall.json
│       ├── sms.json
│       └── outages.json
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DRILL_PROTOCOL.md
│   ├── VIDEO_STORYBOARD.md
│   ├── AI_USAGE.md
│   └── REALIZATION.md        # for IEEE Additional Documents upload
│
├── scripts/
│   ├── bootstrap.sh
│   ├── seed-kodagu.ts
│   ├── build-pmtiles.sh
│   └── deploy.sh
│
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
│
├── biome.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 6. Bootstrap

### 6.1 Prereqs (Day 0 on every machine)

```bash
# Node/Bun runtimes
brew install bun@1.2      # or curl -fsSL https://bun.sh/install | bash
brew install node@22

# pnpm
npm i -g pnpm@9

# Python (for the worker)
brew install python@3.12
pipx install poetry

# PMTiles CLI (basemap prep)
brew install protomaps/protomaps/pmtiles

# Cloudflare Wrangler + Fly CLI
npm i -g wrangler
brew install flyctl

# Twilio CLI (for local webhook tunnel)
brew tap twilio/brew && brew install twilio
```

### 6.2 First-run

```bash
git clone git@github.com:clearsignal/clearsignal.git
cd clearsignal
pnpm install
./scripts/bootstrap.sh        # writes .env from .env.example, seeds Kodagu fixtures
pnpm --filter web dev         # localhost:5173
pnpm --filter edge dev        # localhost:8787 (wrangler)
```

The `bootstrap.sh` script:
1. Copies `.env.example` → `.env` and prompts for API keys (Copernicus, OpenWeather, IMD, Twilio, Neon, Turso, Fly)
2. Creates Neon `main` branch and applies drizzle migrations
3. Creates Turso `clearsignal-dev` database
4. Runs `pnpm --filter kodagu-fixtures build` to compile the 2018 archive to normalized JSON
5. Downloads `kodagu.pmtiles` clip from Protomaps' free tile source

---

## 7. Data adapters (in build order)

Every adapter implements a single interface and lives in `workers/python/adapters/` or `apps/edge/src/routes/` depending on whether it needs Python (SAR/geospatial) or is HTTP-only.

### 7.1 The common shape

```python
# workers/python/adapters/_base.py
from datetime import datetime
from typing import Protocol
from schema import RawEvent, SourceTier

class Adapter(Protocol):
    source_id: str
    tier: SourceTier
    refresh_interval_seconds: int

    async def fetch(self, since: datetime) -> list[RawEvent]:
        """Return all events with source-timestamp >= since."""
        ...
```

Every adapter is:
- **Idempotent** — replaying the same window produces the same events.
- **Fault-tolerant** — network failures return `[]` and log; they never raise.
- **Time-respectful** — timestamps in the source's local zone are converted to UTC in the adapter itself, not later.

### 7.2 Adapter build order and detail

**Priority 1 (Day 2):**

**`sentinel1.py`** — Sentinel-1 SAR flood detection via `dask-flood-mapper`. Takes a bounding box (Kodagu district), a date range, and returns per-500m-cell flood probability. Runs on Fly.io Mumbai. Cache raw pulls to `/data/s1/*.zarr` so replays are free.

**`openweather.py`** — One Call 3.0. Poll every 10 minutes for `current` + `minutely` + `alerts` for each of ~12 talukas in Kodagu. Rainfall > 25 mm/h emits a `heavy_rain` event.

**`cwc_wris.py`** — River gauge readings via the `india-water-data` Python client. Poll hourly for gauges tagged to Kaveri basin (Kodagu is the headwaters). Level > danger-mark emits a `river_danger` event.

**`gdacs.py`** and **`usgs_quake.py`** — GeoJSON feeds, cached with ETag. Rare positive signal in Kodagu but essential for the multi-hazard story.

**Priority 2 (Day 3):**

**`cems_gfm.py`** — Copernicus EMS Global Flood Monitoring via openEO. Free tier is fine. Produces a second, independent SAR-based flood signal that agrees or disagrees with `sentinel1.py`. This is a huge lift for the Comprehensiveness score.

**`imd.py`** — IMD Public APIs. Register once at `api.imd.gov.in`, get an API key. Poll for Karnataka nowcasts, warnings, and district rainfall bulletins. Some endpoints are flaky — wrap in tenacity retries with exponential backoff.

**`nwdp.py`** — National Water Data Portal hourly telemetry. Same schema class as CWC WRIS but different collection cadence. Two sources agreeing on river danger = high confidence.

**`overpass.py`** — OSM road status. On event trigger, query all roads within 5 km of an affected village. Compute a `reachability_score` for that village. This is what turns "flooded" into "flooded AND unreachable".

**`firms.py`** — NASA FIRMS thermal anomalies. Fire perimeters in Kodagu are rare but the multi-hazard story matters for the video.

**Priority 3 (Day 4):**

**`discom_scrape.py`** — Karnataka BESCOM has no free machine-readable API. `geoblackout.com` and `powercut.today` aggregate outages. Scrape hourly, respect robots.txt, cache aggressively. In the write-up call this out as a mock adapter with a planned integration path.

**`sentinel2.py`** — Sentinel-2 optical. Supplement to SAR when the sky is clear. Copy the `sentinel1.py` STAC pattern.

**Priority 4 (Day 5) — the SMS adapter, kept last on purpose because it needs the phone number active:**

**`sms-webhook.ts` (edge)** — a Cloudflare Worker route. Accepts POST from either Twilio or MSG91 (schemas differ; branch on `x-twilio-signature` header presence). Parses body, geolocates by `from` number OR by message-body coordinates, strips PII, tags Tier 4, writes to Neon and Turso, wakes any connected clients via a Server-Sent Event stream.

### 7.3 Fixture strategy for tests

Every adapter ships with a `fixtures/` directory containing one real captured response. Unit tests replay these fixtures. Nothing hits the network in CI.

---

## 8. Normalization pipeline

### 8.1 The common `RawEvent` schema

```typescript
// packages/schema/src/event.ts
import { z } from 'zod';

export const EventType = z.enum([
  'flood_extent',       // SAR + optical + GFM
  'heavy_rain',         // OpenWeather + IMD
  'river_danger',       // CWC + NWDP
  'road_impassable',    // OSM Overpass derived
  'power_outage',       // DISCOM
  'thermal_anomaly',    // FIRMS
  'earthquake',         // USGS
  'multi_hazard_alert', // GDACS
  'citizen_report',     // SMS
]);

export const RawEvent = z.object({
  id: z.string().uuid(),
  source_id: z.string(),           // e.g. 'sentinel-1-cdse'
  source_tier: z.enum(['T1','T2','T3','T4']),
  event_type: EventType,
  location: z.object({
    lat: z.number(),
    lon: z.number(),
    grid_cell_id: z.string(),      // set by normalizer; "12.34_75.67_500m"
    place_name: z.string().nullable(),
    taluka: z.string().nullable(),
    district: z.literal('kodagu'),
  }),
  observed_at_utc: z.string().datetime(),
  received_at_utc: z.string().datetime(),
  raw_value: z.record(z.unknown()),   // adapter-native payload
  normalized_value: z.number().nullable(), // e.g. flood probability 0-1
  confidence_hint: z.number().min(0).max(1).nullable(),
});

export type RawEvent = z.infer<typeof RawEvent>;
```

### 8.2 Normalizer rules

1. **Timestamps** — every `observed_at` from an adapter is UTC before it leaves the adapter. Normalizer verifies with a zod `.datetime()` check and rejects otherwise.
2. **Coordinates** — WGS84 (EPSG:4326). Adapters that source in other CRSes convert in-adapter using `pyproj`.
3. **Grid snap** — every event's `grid_cell_id` is `f"{floor(lat*200)/200:.4f}_{floor(lon*200)/200:.4f}_500m"`. 500 m ≈ 0.0045° at Kodagu's latitude, so we snap to a 0.005° grid.
4. **Deduplication** — within any (`source_id`, `grid_cell_id`) window of 5 minutes, keep the latest `observed_at`.
5. **Place enrichment** — after grid snap, look up `place_name`/`taluka` from `village_geometries` table (village polygons for Kodagu, seeded from OSM).

### 8.3 Storage schema (Neon)

```sql
-- packages/db-schema/migrations/0001_init.sql
CREATE TABLE sources (
  source_id     TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  tier          CHAR(2) NOT NULL CHECK (tier IN ('T1','T2','T3','T4')),
  refresh_seconds INT NOT NULL,
  last_success_at TIMESTAMPTZ,
  last_error_at   TIMESTAMPTZ,
  last_error_msg  TEXT
);

CREATE TABLE events (
  id            UUID PRIMARY KEY,
  source_id     TEXT NOT NULL REFERENCES sources(source_id),
  source_tier   CHAR(2) NOT NULL,
  event_type    TEXT NOT NULL,
  grid_cell_id  TEXT NOT NULL,
  place_name    TEXT,
  taluka        TEXT,
  district      TEXT NOT NULL DEFAULT 'kodagu',
  lat           DOUBLE PRECISION NOT NULL,
  lon           DOUBLE PRECISION NOT NULL,
  observed_at   TIMESTAMPTZ NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_value     JSONB NOT NULL,
  normalized_value DOUBLE PRECISION,
  confidence_hint  DOUBLE PRECISION
) PARTITION BY RANGE (observed_at);

-- daily partitions; scheduler creates them one day ahead
CREATE INDEX ON events (grid_cell_id, observed_at DESC);
CREATE INDEX ON events (event_type, observed_at DESC);
CREATE INDEX ON events (source_id, observed_at DESC);

CREATE TABLE village_geometries (
  village_id    TEXT PRIMARY KEY,
  place_name    TEXT NOT NULL,
  taluka        TEXT NOT NULL,
  district      TEXT NOT NULL,
  centroid_lat  DOUBLE PRECISION NOT NULL,
  centroid_lon  DOUBLE PRECISION NOT NULL,
  geometry      JSONB NOT NULL,  -- GeoJSON polygon
  population    INT
);

CREATE TABLE recommendations (
  id            UUID PRIMARY KEY,
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  village_id    TEXT REFERENCES village_geometries(village_id),
  grid_cell_id  TEXT NOT NULL,
  composite_score DOUBLE PRECISION NOT NULL,
  band          CHAR(1) NOT NULL CHECK (band IN ('H','M','L')),
  reason_text   TEXT NOT NULL,
  oldest_source_age_sec INT NOT NULL,
  conflict_flag BOOLEAN NOT NULL DEFAULT FALSE,
  contributing_event_ids UUID[] NOT NULL
);

CREATE INDEX ON recommendations (computed_at DESC, composite_score DESC);
```

### 8.4 Turso slice (mobile-syncable)

The Turso database mirrors a subset — only the last 24 hours of `recommendations` and the `village_geometries` table. Everything else stays in Neon. This keeps the phone's local database under 20 MB.

---

## 9. Fusion engine

### 9.1 The formula (from submission, unchanged)

```
Score = 0.35 × recency_score + 0.45 × agreement_score + 0.20 × reliability_score
```

Normalized to 0–100. Bands: ≥70 High, 40–69 Medium, <40 Low.

### 9.2 Component definitions

**`recency_score`** — for each of the top-N contributing events for a candidate location, `exp(-age_seconds / half_life_seconds)`. Take the maximum across contributing sources. `half_life_seconds` is per-source and comes from `weights.yaml`. Sentinel-1 has a longer half-life (SAR is precious); SMS has a short one (people move).

**`agreement_score`** — count of *independent* sources (distinct `source_id` in different tiers) reporting the same event type within the same grid cell in the last 60 minutes. Normalized: `min(1.0, n_sources / 4)`. Four independent sources = full agreement.

**`reliability_score`** — weighted average of contributing sources' tier weights. T1 = 1.0, T2 = 0.85, T3 = 0.6, T4 = 0.35.

### 9.3 `config/weights.yaml`

```yaml
version: 1.0
formula:
  recency_weight: 0.35
  agreement_weight: 0.45
  reliability_weight: 0.20
bands:
  high_threshold: 70
  medium_threshold: 40
tier_weights:
  T1: 1.00
  T2: 0.85
  T3: 0.60
  T4: 0.35
source_half_life_seconds:
  sentinel-1-cdse: 21600      # 6h — matches revisit
  sentinel-2-cdse: 43200
  cems-gfm: 86400
  firms-nasa: 10800
  openweather: 900            # 15m — rain is time-critical
  imd: 900
  cwc-wris: 3600
  nwdp: 3600
  overpass: 21600             # road status decays slowly
  gdacs: 300
  usgs-quake: 300
  twilio-sms: 900
  msg91-sms: 900
  discom-outage: 1800
agreement:
  window_seconds: 3600
  independence_by: tier       # only cross-tier signals count as independent
  max_sources_for_full_score: 4
```

### 9.4 The Village A / Village B unit test

This is a golden test that MUST pass. It reproduces the submission's worked example. Failing this test blocks a merge.

```typescript
// apps/edge/src/fusion/engine.test.ts
import { describe, it, expect } from 'vitest';
import { computeScore } from './engine';
import weights from '../../../packages/schema/weights.yaml';

describe('Village A / Village B golden case', () => {
  it('Village A: 7 independent signals agreeing → Score 87 → High', () => {
    const events = [
      { source: 'sentinel-1-cdse', tier: 'T2', age_s: 22*60, type: 'flood_extent' },
      { source: 'discom-outage',   tier: 'T4', age_s:  8*60, type: 'power_outage' },
      { source: 'discom-outage',   tier: 'T4', age_s: 11*60, type: 'power_outage' },
      { source: 'twilio-sms',      tier: 'T4', age_s:  5*60, type: 'citizen_report' },
      { source: 'twilio-sms',      tier: 'T4', age_s: 12*60, type: 'citizen_report' },
      { source: 'twilio-sms',      tier: 'T4', age_s: 17*60, type: 'citizen_report' },
      { source: 'twilio-sms',      tier: 'T4', age_s: 19*60, type: 'citizen_report' },
    ];
    const s = computeScore(events, weights);
    expect(s.composite).toBeGreaterThanOrEqual(85);
    expect(s.composite).toBeLessThanOrEqual(89);
    expect(s.band).toBe('H');
  });

  it('Village B: 1 unverified post, 3h old → Score ~17 → Low', () => {
    const events = [
      { source: 'twilio-sms', tier: 'T4', age_s: 3*3600, type: 'citizen_report' },
    ];
    const s = computeScore(events, weights);
    expect(s.composite).toBeGreaterThanOrEqual(14);
    expect(s.composite).toBeLessThanOrEqual(20);
    expect(s.band).toBe('L');
  });
});
```

### 9.5 The `explain()` function

Producing the plain-English reason is not optional. It is a judged criterion (Integration + Usability). The function returns a string like:

> *"High: satellite flood extent, two power-outage pings, and four SMS reports agree, all within 28 minutes"*

Rules:
- Name the top three contributing event types by tier order (T1 > T2 > T3 > T4).
- Group repeated sources ("two power-outage pings").
- End with the oldest contributing source's age relative to a rounded ceiling ("within 28 minutes" not "27m 42s").
- If any source is stale beyond its half-life, prefix with "Stale: ".
- If a conflicting signal exists (e.g., safe SMS from same cell), prefix with "Conflict: " and enumerate both sides.

---

## 10. PWA frontend

### 10.1 Primary screen spec

```
┌─────────────────────────────────────────┐
│  ClearSignal    Kodagu · Aug 17 · 14:22 │  ← header, 48px tall
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  ⌕ Which villages need evacuati…  │  │  ← text input, 56px tall
│  └───────────────────────────────────┘  │  ← touch target 48×48 min
│                                         │
│  ▲ MAKKANDUR · Madikeri taluka          │
│  ┌───────────────────────────────────┐  │
│  │  🟢 HIGH  87       oldest 28 min  │  │  ← recommendation card
│  │  Satellite flood extent, two      │  │
│  │  power-outage pings, and four     │  │
│  │  SMS reports agree                │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ▲ BHAGAMANDALA · Madikeri taluka       │
│  ┌───────────────────────────────────┐  │
│  │  🟢 HIGH  82       oldest 15 min  │  │
│  │  River gauge above danger + two   │  │
│  │  citizen reports                  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ▲ MUKKODLU · Madikeri taluka           │
│  ┌───────────────────────────────────┐  │
│  │  🟡 MEDIUM  54    oldest 45 min   │  │
│  │  ⚠ Conflict: satellite says       │  │
│  │  flooded, SMS reports safe        │  │
│  └───────────────────────────────────┘  │
│                                         │
├─────────────────────────────────────────┤
│  [ Map ]  [ List ]  [ Sources ]         │  ← bottom tabs, 56px
└─────────────────────────────────────────┘
```

### 10.2 Design constraints (verifiable acceptance criteria)

- Every touch target ≥ 48 × 48 CSS pixels.
- No text below 16 px on the primary screen. Cards use 18 px reason text.
- Contrast ratio ≥ 4.5:1 for all text against its background.
- The screen renders and is interactive in ≤ 3 seconds on a Samsung Galaxy A54 4G with a cold cache.
- Colors: High = `#0EA657`, Medium = `#F0A020`, Low = `#B02020`. Verified in `dataviz` skill palette.

### 10.3 Offline behavior spec

| State | Trigger | UI |
|---|---|---|
| **Online, fresh** | ≤ 15 min since any source refresh | (no banner) |
| **Online, stale** | > 15 min since all sources refreshed | yellow banner: *"Sources refreshing…"* |
| **Offline, cached** | `navigator.onLine === false` and cache < 24 h old | blue banner: *"Offline · showing last data from HH:MM"* |
| **Offline, expired** | cache > 24 h old | red banner: *"Offline · data older than 24 hours"* |
| **Source missing** | any Tier 1 or Tier 2 source silent > half-life × 2 | inline chip on affected recommendations |

### 10.4 Service worker strategy

- **App shell** — `precacheAndRoute` from Workbox at build time.
- **PMTiles basemap** — cache-first, indefinite TTL (they don't change).
- **API `/rankings`** — network-first with a 3-second timeout, falling back to cached last-known-good. Cached response is stamped with age.
- **API `/recommendation/:id`** — stale-while-revalidate, 1-hour TTL.
- **Twilio webhook** — never cached (it's outbound, on the server).

### 10.5 Dexie schema

```typescript
// apps/web/src/storage/dexie.ts
import Dexie, { Table } from 'dexie';

interface CachedRanking {
  district: string;
  computed_at_utc: string;
  recommendations: Recommendation[];
  synced_at_local: number;
}

interface CachedEvent {
  id: string;
  grid_cell_id: string;
  event_type: string;
  observed_at_utc: string;
  source_id: string;
  source_tier: 'T1'|'T2'|'T3'|'T4';
  normalized_value: number | null;
}

class ClearSignalDb extends Dexie {
  rankings!: Table<CachedRanking, string>;
  events!: Table<CachedEvent, string>;
  sourcesStatus!: Table<{ source_id: string; last_seen_utc: string; healthy: boolean }, string>;

  constructor() {
    super('clearsignal');
    this.version(1).stores({
      rankings: 'district, computed_at_utc',
      events: 'id, [grid_cell_id+observed_at_utc], event_type, source_id',
      sourcesStatus: 'source_id, last_seen_utc',
    });
  }
}

export const db = new ClearSignalDb();

// Request persistent storage BEFORE the event begins
export async function requestPersistence() {
  if (navigator.storage?.persist) {
    const granted = await navigator.storage.persist();
    console.log('Persistent storage granted:', granted);
  }
}
```

### 10.6 Kannada glossary (for supporting docs, not UI)

The submission commits to English-only UI for the demo. For the drill's laminated card and for IEEE MOVE India field kits, include this glossary:

| English | Kannada | Transliteration |
|---|---|---|
| Which villages need evacuation support first? | ಮೊದಲು ಯಾವ ಗ್ರಾಮಗಳಿಗೆ ಸ್ಥಳಾಂತರ ಸಹಾಯ ಬೇಕು? | Modalu yāva grāmagaḷige sthaḷāntara sahāya bēku? |
| High confidence | ಹೆಚ್ಚಿನ ವಿಶ್ವಾಸ | Heccina viśvāsa |
| Medium confidence | ಮಧ್ಯಮ ವಿಶ್ವಾಸ | Madhyama viśvāsa |
| Low confidence | ಕಡಿಮೆ ವಿಶ್ವಾಸ | Kaḍime viśvāsa |
| Offline | ಆಫ್‌ಲೈನ್ | Āphlain |
| Sources disagree | ಮೂಲಗಳು ಒಪ್ಪುತ್ತಿಲ್ಲ | Mūlagaḷu oppuvttilla |

Verify these with a native speaker before shipping.

---

## 11. Turso Sync layer

### 11.1 What Turso Sync does for us

The submission promises: (a) works offline after first load, (b) reconciles cleanly when connectivity returns, (c) accepts SMS while offline via the backend, replays them when the phone reconnects.

Turso Sync gives us all three without hand-rolling CRDTs.

### 11.2 Push / pull loop

```typescript
// apps/web/src/storage/sync.ts
import { createClient } from '@tursodatabase/database';

const client = createClient({
  url: 'file:local.db',
  syncUrl: import.meta.env.VITE_TURSO_URL,
  authToken: import.meta.env.VITE_TURSO_TOKEN,
});

export async function startSyncLoop() {
  // Initial catchup
  await client.sync();

  // Background loop — every 20s when online
  setInterval(async () => {
    if (!navigator.onLine) return;
    try {
      await client.sync();
    } catch (e) {
      console.warn('Sync failed, will retry:', e);
    }
  }, 20_000);

  // Immediate sync on reconnect
  window.addEventListener('online', () => client.sync().catch(() => {}));
}
```

### 11.3 Conflict resolution

The phone never writes to the shared tables (`rankings`, `events`, `village_geometries`). It only reads. Writes come from the backend. So there is no conflict to resolve, ever. Last-Push-Wins is fine.

The only phone-local writes are to a per-user `ui_state` table (last selected filter, unsent draft, etc.), which is not synced.

---

## 12. Scenario replayer

### 12.1 What it does

Replays the documented August 2018 Kodagu disaster (8 days of events) at configurable speed (default 60×) into the same adapters and pipeline that live sources use. This is what makes the demo video look like a live disaster response without waiting for a real one.

### 12.2 Event archive assembly

`packages/kodagu-fixtures/` contains normalized fixtures for:

- **Rainfall** — daily district totals from IMD historical archive for Aug 10–17, 2018
- **Landslides** — 105 events with coordinates from Geological Survey of India post-event report
- **River gauge levels** — CWC daily bulletins for Kaveri stations, Aug 2018
- **Power outages** — reconstructed from state DISCOM press releases and news archives
- **SMS reports** — 24 synthetic citizen reports, timestamped to match the documented panic windows

Each fixture has real coordinates, real timestamps (mapped to the replay clock), and real values (rainfall in mm, gauge level in m, etc.). Only the SMS content is synthetic and is clearly labeled as such in the drill documentation.

### 12.3 The clock

```python
# workers/python/replayer/clock.py
from datetime import datetime, timedelta
from dataclasses import dataclass

@dataclass
class ReplayClock:
    """Maps real time → simulated August 2018 time."""
    real_start: datetime      # wall-clock time when replay was started
    sim_start: datetime       # e.g. 2018-08-10 06:00:00 UTC
    speed: float = 60.0       # 60x = 1 real minute is 1 sim hour

    def now_sim(self) -> datetime:
        elapsed_real = datetime.utcnow() - self.real_start
        elapsed_sim = elapsed_real * self.speed
        return self.sim_start + elapsed_sim

    def sim_seconds_since_start(self) -> float:
        return (self.now_sim() - self.sim_start).total_seconds()
```

### 12.4 The replayer loop

Every 5 real seconds, the replayer:
1. Computes `now_sim`.
2. Queries fixtures for all events with `observed_at ∈ (last_now_sim, now_sim]`.
3. Feeds them into the same adapter pipeline as live sources (each fixture is tagged with its source_id).
4. Advances `last_now_sim`.

At 60× speed, 8 days of Kodagu 2018 plays out in 3 hours 12 minutes real time. For the 3-minute video, we choose a 3-minute slice starting at the moment satellite passes first detected the flood spread — August 16, 09:00 sim time, ending at 12:00 sim time.

### 12.5 Determinism

Fixtures ship with a fixed RNG seed for anything stochastic (SMS timing jitter, gauge measurement noise). Every replay produces identical events, which means the video shoot is repeatable and the golden Village A/B test remains reliable.

---

## 13. API contracts

All endpoints share:

- Base URL: `https://api.clearsignal.app/`
- Content-Type: `application/json`
- CORS: `Access-Control-Allow-Origin: https://clearsignal.app`

### 13.1 `GET /rankings`

Query: `district=kodagu` (only value supported in v1).

```jsonc
// 200 OK
{
  "district": "kodagu",
  "computed_at_utc": "2026-09-26T14:22:00Z",
  "recommendations": [
    {
      "id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
      "village_id": "kdg-makkandur",
      "place_name": "Makkandur",
      "taluka": "Madikeri",
      "centroid": { "lat": 12.4123, "lon": 75.7245 },
      "composite_score": 87,
      "band": "H",
      "reason_text": "Satellite flood extent, two power-outage pings, and four SMS reports agree, all within 28 minutes",
      "oldest_source_age_sec": 1680,
      "conflict_flag": false,
      "contributing_event_ids": [ "…", "…" ]
    }
  ],
  "sources_status": [
    { "source_id": "sentinel-1-cdse", "healthy": true, "last_seen_utc": "..." },
    { "source_id": "cwc-wris",        "healthy": true, "last_seen_utc": "..." }
  ]
}
```

### 13.2 `GET /recommendation/:id`

Returns one recommendation plus the full list of contributing events with their raw values. Used when the officer taps a card to see "why".

### 13.3 `POST /sms-webhook`

Accepts Twilio (form-encoded) or MSG91 (JSON). Detects via presence of `X-Twilio-Signature` header. Body parsed into a `RawEvent`, tagged Tier 4, stored, and triggers a fusion recompute for the affected grid cell.

### 13.4 `GET /sources/status`

Health-check-style endpoint. Returns per-source `last_success_at`, `last_error_at`, `last_error_msg`, `refresh_interval_seconds`. Used by the UI to surface stale-source warnings.

---

## 14. Testing strategy

### 14.1 The three test tiers

1. **Unit** — every adapter, every fusion component, every normalization rule. Vitest for TS, pytest for Python. Fixtures replay real captured responses.
2. **Golden** — the Village A / Village B case from §9.4. This is a merge-blocker.
3. **End-to-end** — Playwright scripts that drive the PWA:
   - "Cold-cache load in under 3 seconds on throttled 3G" (using Playwright's network throttling).
   - "Airplane mode → ranked list still renders → banner appears".
   - "SMS webhook received → PWA card updates within 4s" (mock webhook posts to backend).
   - "Contradiction case → both signals visible on card".

### 14.2 The 90-second comprehension drill (video evidence)

This is the one *user validation* claim in the original submission. Running it for real converts an assertion to evidence.

**Protocol:**

- Recruit 5–8 volunteers who are not on the ClearSignal team.
- Each volunteer gets a 3-minute onboarding: what a disaster response officer does, what ClearSignal is.
- They receive a Samsung Galaxy A-series phone (A54 or A34) with the PWA pre-installed and warmed.
- Stopwatch starts when the app is handed to them.
- Task: "Which village should we send help to first, and why should you trust that?"
- Stopwatch stops when they name the correct village AND state at least one reason.
- Target: median under 90 seconds.

**Record:** each participant's time, whether they correctly identified the top village, and one sentence of qualitative feedback. Log to `docs/DRILL_PROTOCOL.md` with photos (with consent) and raw times.

**Video use:** montage the drill runs into 12–15 seconds of B-roll for the Usability beat of the video.

### 14.3 What we intentionally do NOT test

- Load testing beyond 100 concurrent users. Not required for demo; a note in `§20 Risk log`.
- Cross-browser matrix. Chrome on Android + Safari on iOS. That is enough.
- Multi-language i18n. English-only for v1.

---

## 15. Deployment

### 15.1 Environments

| Env | PWA host | API host | Data | Purpose |
|---|---|---|---|---|
| **local** | Vite dev | Wrangler dev | Neon `dev` branch, Turso `dev` | Day-to-day dev |
| **staging** | Cloudflare Pages `clearsignal-staging` | CF Workers `clearsignal-api-staging` | Neon `staging` | Integration + drill |
| **prod** | Cloudflare Pages `clearsignal-app` | CF Workers `clearsignal-api` | Neon `main` | Judge-facing URL |

### 15.2 The judge-facing URL

Prod points at `https://clearsignal.app` (buy the domain on Day 1; Cloudflare Registrar, ~$10/yr). The PWA install prompt fires on first visit. This is the URL that goes in the IEEE "Product Video Link" field if we choose Hosted Elsewhere for a supporting artifact.

### 15.3 Deploy pipeline

```yaml
# .github/workflows/deploy.yml
name: deploy
on:
  push:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter '*' test
      - run: pnpm --filter web build

  deploy-web:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          command: pages deploy apps/web/dist --project-name clearsignal-app

  deploy-edge:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          workingDirectory: apps/edge
          command: deploy

  deploy-worker:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --config workers/python/fly.toml
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

### 15.4 Domain and TLS

Cloudflare Registrar buys the domain and provides automatic TLS. `clearsignal.app` is a `.app` domain, which mandates HSTS preload — a PWA install requirement. Do not use a `.com` unless the `.app` is unavailable.

---

## 16. Demo video storyboard (3 minutes)

The video is the single most important deliverable in this stage. Every second is mapped to a judged criterion and to one of the three winning moments from `§1.3`.

### 16.1 Cast and shot list

- **Narrator (V/O)** — calm, first-person, treated as the field officer.
- **Phone shot** — Samsung Galaxy A54 held in hand, real screen recording, real replay.
- **Insert graphic** — one architecture panel and one confidence-math panel, both pulled from the existing IEEE-portal infographics with minor updates.
- **Off-camera participant** — sends the SMS from a Nokia feature phone.

### 16.2 Beat sheet (mm:ss)

**00:00–00:20 · Anchor — the Kodagu question** *(Scenario Fit)*
- V/O: "August 2018. Kodagu district, Karnataka. Three thousand millimeters of rain in eight months. 105 landslides in eight days. Every tower down. Every road cut. A rescue team on a satellite phone had one question: which village first."
- Shot: photo of the 2018 event, dissolve to the ClearSignal PWA on a phone.

**00:20–00:55 · The one screen** *(Usability, Timeliness)*
- V/O: "One question, three seconds, one screen."
- Shot: PWA cold launch → primary screen renders in <3s → text input auto-fills with the default question → ranked list appears with Makkandur at the top.
- On-screen callouts: "Cold cache. 3G throttled." · "First recommendation: 2.4 seconds."

**00:55–01:30 · The confidence math** *(Integration)*
- V/O: "Every rank has a number. Every number has three parts: how fresh, how many sources agree, how trustworthy each source is."
- Shot: tap top card → detail view slides up → equation graphic overlays briefly: `Score = 0.35 × recency + 0.45 × agreement + 0.20 × reliability`
- Village A worked example plays on screen: 7 signals, all within 28 minutes → Score 87.
- Cut to Village B: 1 unverified post, 3 hours old → Score 17.
- V/O: "Both are villages. Only one is worth the boat."

**01:30–02:05 · Offline. Airplane mode.** *(Timeliness, Reliability)*
- V/O: "In Kodagu 2018, every mobile tower went down."
- Shot: phone flipped to airplane mode → blue banner: *"Offline · showing last data from 14:22"* → the list is still there → officer scrolls, taps.
- Cut back online → sync spinner → data refreshes.
- V/O: "Offline is not a failure mode. It's Tuesday."

**02:05–02:40 · The SMS moment** *(Comprehensiveness, Novel Data)*
- V/O: "In 2018, one volunteer in Bhagamandala had a Nokia phone and no one to text. In 2026, they have us."
- Shot: split screen — Nokia feature phone on left, ClearSignal PWA on right. Volunteer thumbs "flooded near school", hits send. Within 4 seconds, the ClearSignal card for Bhagamandala updates: new SMS, oldest source age recomputes, confidence jumps.
- Contradiction shot: satellite says "flooded" but a second SMS says "safe". Both surface on the card with sources and timestamps. Conflict flag glows.
- V/O: "We don't hide disagreement. We surface it."

**02:40–03:00 · The IEEE hook and the ask** *(Scenario Fit + Ecosystem Fit)*
- V/O: "IEEE MOVE deployed to Wayanad in 2024 with power and comms. IEEE SIGHT is on the ground across Karnataka and Kerala. ClearSignal is the software intelligence layer they operate without today."
- Shot: `ieee-move.png` overlay of the MOVE vehicle plus ClearSignal.
- Closing card: `clearsignal.app` — a QR code — "Live now. Kodagu district. Open on any phone."

### 16.3 Post-production notes

- Filmed on the phone itself for the phone shots (Samsung A54's own screen recorder). No emulator.
- Real time throughout. No sped-up shots. Trust the app to be fast.
- On-screen text at 32px minimum for phone-camera legibility.
- Cite each real dataset by name in a two-second end-frame ("Data: Copernicus / IMD / CWC / NASA FIRMS / GDACS · Source: this study").

---

## 17. Supporting documents package

To be uploaded in the IEEE "Additional Product-Related Documents (Optional)" field. Even though optional, they convert asserted claims to evidence.

### 17.1 `REALIZATION.md` — one-page write-up

Structure:
- **What we built** (3 sentences)
- **What is real vs simulated** (small table)
- **Live URL and the three moments** (with a QR)
- **Numbers** (drill median time, latency measurements, source count)
- **What's next** (three bullets, honest)

### 17.2 `ARCHITECTURE.md` — the diagram + adapter list

Full version of `§3` plus a per-adapter one-liner.

### 17.3 `DRILL_PROTOCOL.md` — the 90-second evidence

Photos with participant consent, raw stopwatch times per participant, correct/incorrect count, one-sentence quotes.

### 17.4 `AI_USAGE.md` — the disclosure

Draft:

> The ClearSignal concept, prose, and product realization used the following AI systems:
>
> - **Claude (Anthropic)** — architecture review, adapter code generation, backend scaffolding, API contract drafting, and copy-editing of the submission text and this documentation package.
> - **Cursor with Claude Sonnet 4.7** — day-to-day code editing, refactors, and test authoring across the monorepo.
> - **v0.dev** — initial React component seeds for the primary screen and the recommendation card, which the team then adapted to the design constraints in this spec.
> - **Bolt.new** — one-shot scaffold of the Python scenario replayer.
>
> No AI system is present at runtime in the deployed ClearSignal product. The confidence engine is a deterministic linear function specified in `weights.yaml`. No machine-learning inference is performed on device or on the backend. Data adapters convert third-party feeds into a common schema without any generative or ranking model.
>
> Volunteers in the 90-second comprehension drill were human, over 18, and consented to being recorded for the video and this documentation.

### 17.5 Deck (5–7 slides)

Rebuild lightly from the existing infographics uploaded to the IEEE portal:
- Slide 1: the Kodagu question (uses `emergency-response-decision-infographic-1.png` as background)
- Slide 2: what a responder sees (screenshot of primary screen)
- Slide 3: the confidence engine (uses `data-overload-to-decision-triage-1.png`)
- Slide 4: the six-stage pipeline (uses `flow-diagram.png`)
- Slide 5: IEEE MOVE / SIGHT fit (uses `ieee-move.png`)
- Slide 6: numbers (drill median, latency, source count, live URL, QR)
- Slide 7: what's next + ask (see `§17.1`)

---

## 18. Day-by-day plan

Assumes a "team" of one human orchestrator + the AI workforce from `§4.7`. Each day names one deliverable that must be demonstrable by end-of-day.

### Day 1 — Repo, storyboard, deploy targets

**Deliverable:** empty repo pushed to GitHub, `clearsignal.app` registered, Cloudflare Pages + Workers projects created, Fly.io Mumbai app created, Neon + Turso databases created. Storyboard from `§16` locked in `docs/VIDEO_STORYBOARD.md`.

**Owners:** Human (accounts, credentials, storyboard). Claude Code (scripts/bootstrap.sh, wrangler.toml, fly.toml).

### Day 2 — Skeleton PWA + first three adapters

**Deliverable:** Vite React app deployed to Pages showing a hardcoded ranked list. Sentinel-1 adapter running on Fly.io producing real events into Neon. OpenWeather and CWC adapters live.

**Owners:** v0.dev (component seeds). Claude Code (adapters, Neon schema). Cursor (wiring).

### Day 3 — Fusion engine + scenario replayer

**Deliverable:** Village A/B golden test passing. Scenario replayer feeding fixture events into the pipeline at 60× speed. `/rankings` endpoint returning real computed scores.

**Owners:** Claude Code (fusion engine, both test and implementation). Bolt.new (replayer scaffold, then Claude Code hardens it).

### Day 4 — Offline + map + remaining adapters

**Deliverable:** PMTiles basemap cached and rendering offline. Workbox strategies in place. Airplane mode E2E test passing. CEMS GFM, IMD, NWDP, Overpass, FIRMS, GDACS, USGS adapters live.

**Owners:** Cursor (offline behavior, service worker). Claude Code (remaining adapters). Human (visual check on mobile device).

### Day 5 — SMS ingest + explain function + drill

**Deliverable:** Twilio number provisioned. `/sms-webhook` receiving real SMS and updating rankings within 4 seconds. `explain()` producing plain-English reasons that read correctly for 20 cases. 90-second drill run with 5+ volunteers, results logged.

**Owners:** Claude Code (webhook, explain). Human (drill logistics, video capture).

### Day 6 — Polish + supporting docs

**Deliverable:** UI polish pass. All accessibility acceptance criteria met. `REALIZATION.md`, `ARCHITECTURE.md`, `DRILL_PROTOCOL.md`, `AI_USAGE.md` complete. Deck built.

**Owners:** Cursor (UI polish). Human (docs writing with Claude Code assist).

### Day 7 — Video shoot

**Deliverable:** 3-minute video, cut, color-graded, uploaded unlisted to YouTube. Fallback MP4 rendered under 50 MB in case we upload direct to IEEE.

**Owners:** Human (director, VO, phone shots). Any competent NLE (DaVinci Resolve free tier or Descript).

### Day 8 — Buffer / re-shoot / upload rehearsal

**Deliverable:** IEEE portal fields pre-populated in "Save as draft" mode. Every field filled but "Submit for Review" left No.

### Day 9 — Final pass

**Deliverable:** Second pair of eyes reviews the whole submission. One typo pass on `REALIZATION.md`. QR code on the closing frame verified against the live URL.

### Day 10 — Submit

**Deliverable:** IEEE portal Complete Task fired with Submit for Review = Yes. Confirmation screenshot in `docs/`. Rules-acceptance checkbox ticked.

---

## 19. Judge-facing evidence checklist

When a judge clicks through the submission, they will encounter:

- [ ] The live PWA at `clearsignal.app`, installable, works offline.
- [ ] A 3-minute video with the three winning moments.
- [ ] `REALIZATION.md` naming what is real, what is simulated, what is next.
- [ ] `ARCHITECTURE.md` with the six-stage pipeline diagram matching the video.
- [ ] `DRILL_PROTOCOL.md` with photos, raw times, and the median result.
- [ ] `AI_USAGE.md` truthful, specific, no boilerplate.
- [ ] Rules-acceptance checkbox ticked.
- [ ] Product Video Type = "Hosted Elsewhere" with a YouTube unlisted URL.
- [ ] Submit for Review = Yes.

If any of the above is missing, the submission is not ready.

---

## 20. Risk log

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| IMD API rate-limits or downtime | Med | Low | OpenWeather is the primary rain source; IMD as second. |
| Copernicus quota exhausted mid-demo | Low | High | Cache all SAR pulls; replayer uses cached tiles. |
| Twilio inbound India DLT registration delay | High | Med | Use US Twilio number for the video shoot; text from US SIM. Note MSG91 as India-native alternative in write-up. |
| Turso Sync bug (young product) | Med | Med | Keep Dexie as source of truth; Turso as sync spine. Falls back to network-only if Turso is down. |
| Volunteer drill produces bad times | Low | High | Run with 8+ people; report median, not mean; if median > 90s, drop the specific claim from the video and keep the qualitative footage. |
| Demo video shoot goes over 5 min or under 2 min | Med | High | Shoot beats separately, cut ruthlessly, use `§16.2` timing as a hard budget. |
| Live URL goes down during judging | Low | Catastrophic | Cloudflare Pages has 99.99% SLA; keep last known good `dist/` in the repo, redeploy in one command. |
| BESCOM/DISCOM scrape breaks | Med | Low | It's a fallback signal only. Video does not depend on it. |
| Judge attempts to view on desktop | Med | Low | PWA is responsive; a desktop viewer sees the same list but wider. Include one shot in the video of it rendering on a tablet. |
| DLT / TRAI regulatory question in judging | Low | Med | `AI_USAGE.md` and `REALIZATION.md` note DLT is required for India inbound SMS at scale; MSG91 handles it in the deployment path. |

---

## 21. Appendices

### 21.1 Appendix A — Kodagu 2018 event archive (fixture summary)

| Type | Source | Count | Time range |
|---|---|---|---|
| Landslides (confirmed) | GSI post-event report | 105 | 2018-08-10 → 2018-08-17 |
| Daily rainfall (mm) | IMD Aug 2018 archive | 8 (one per day) | 2018-08-10 → 2018-08-17 |
| CWC gauge readings | CWC daily bulletins | 32 (Kaveri basin stations) | 2018-08-10 → 2018-08-17 |
| Power outage windows | State DISCOM press + news | 18 | 2018-08-14 → 2018-08-17 |
| Synthetic citizen SMS | ClearSignal team | 24 | 2018-08-15 → 2018-08-17 |

Full JSON in `packages/kodagu-fixtures/`.

### 21.2 Appendix B — Confidence formula parameter table

See `apps/web/src/fusion/weights.yaml` for the runtime source of truth. Do not maintain a second copy of these numbers.

### 21.3 Appendix C — Data source contact and license

| Source | License | Attribution required? | Contact |
|---|---|---|---|
| Copernicus Data Space | Copernicus License (free reuse with attribution) | Yes: "Contains modified Copernicus Sentinel data 2026" | dataspace.copernicus.eu |
| CEMS GFM | Copernicus License | Yes | emergency.copernicus.eu |
| NASA FIRMS | Public domain | Recommended | earthdata.nasa.gov/firms |
| OpenWeather | Paid subscription | Per T&C | openweathermap.org |
| IMD | Free with registration | Yes | api.imd.gov.in |
| CWC WRIS | Open Government Data License India | Yes | cwc.gov.in |
| OSM Overpass | ODbL | Yes: "© OpenStreetMap contributors" | overpass-api.de |
| GDACS | Free | Yes | gdacs.org |
| USGS | Public domain | Recommended | earthquake.usgs.gov |
| Twilio | Commercial | N/A | twilio.com |
| MSG91 | Commercial (India) | N/A | msg91.com |

### 21.4 Appendix D — References

- Bauer-Marschallinger, B. et al. (2022). *A Bayesian-based, near-real-time flood mapping algorithm using Sentinel-1 data.* Remote Sensing of Environment.
- interTwin project. *Dask Flood Mapper* — [github.com/interTwin-eu/dask-flood-mapper](https://github.com/interTwin-eu/dask-flood-mapper).
- Copernicus EMS. *Global Flood Monitoring* — [global-flood.emergency.copernicus.eu](https://global-flood.emergency.copernicus.eu/technical-information/glofas-gfm/).
- Angelopoulos & Bates (2023). *A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification.*
- CWC / MoJS (2024). *India-WRIS Training Materials.*
- IMD (2026). *Public API Reference* — [api.imd.gov.in/public/api_reference.html](https://api.imd.gov.in/public/api_reference.html).
- Protomaps. *PMTiles specification* — [github.com/protomaps/PMTiles](https://github.com/protomaps/PMTiles).
- MapLibre. *MapLibre GL JS documentation* — [maplibre.org](https://maplibre.org).
- Turso. *Introducing Databases Anywhere with Turso Sync* — [turso.tech/blog](https://turso.tech/blog/introducing-databases-anywhere-with-turso-sync).
- Hono. *Hono documentation* — [hono.dev](https://hono.dev).
- Twilio. *Messaging Webhooks* — [twilio.com/docs/usage/webhooks/messaging-webhooks](https://www.twilio.com/docs/usage/webhooks/messaging-webhooks).

---

## 22. Change log

| Version | Date | Change |
|---|---|---|
| v1.0 | 2026-09-26 | First complete draft. |

---

**End of spec.**

Ship it.