# ClearSignal — Architecture

> One question: *"Which villages need evacuation support first, and how much should I trust that answer?"*
> One district (Kodagu), one persona (SDMA field coordinator), one hazard class (flash flood + landslide), one screen, one formula.

## System at a glance

```
┌──────────────────────────────────────────────────────────────┐
│  PHONE (PWA)  apps/web                                       │
│  React 19 · Tailwind 4 · zustand · MapLibre GL + PMTiles     │
│  Workbox service worker · Dexie (IndexedDB) last-known-good  │
└────────────┬─────────────────────────────────────────────────┘
             │ HTTPS when online · SSE "rankings-changed" push
┌────────────▼─────────────────────────────────────────────────┐
│  EDGE API  apps/edge  (Hono · Cloudflare Workers / Node)     │
│   GET  /rankings?district=kodagu   GET /recommendation/:id   │
│   GET  /sources/status             GET /weights  (YAML)      │
│   POST /sms-webhook  (Twilio form | MSG91 JSON)              │
│   POST /ingest       (worker batches, bearer token)          │
│   GET  /stream       (Server-Sent Events)                    │
│   Fusion engine: packages/fusion (same code the tests run)   │
└────────────┬─────────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────────┐
│  DATA                                                        │
│  Neon Postgres (events partitioned by day, sources,          │
│    village_geometries, recommendations) — or in-memory store │
│    seeded with the Kodagu 2018 replay when DATABASE_URL unset│
│  Python worker workers/python (Fly.io, Mumbai) → POST /ingest│
└──────────────────────────────────────────────────────────────┘
```

## The six pipeline stages

| Stage | Where | What happens |
|---|---|---|
| **1 Ingest** | `workers/python/adapters/*`, `apps/edge/src/app.ts` (`/sms-webhook`) | Each adapter turns a source's native payload into a `RawEvent` (`packages/schema/src/event.ts`). Timestamps become UTC inside the adapter. Network failures return `[]`. |
| **2 Normalize** | `packages/fusion/src/normalize.ts` | zod validation (UTC, WGS84), snap to a 0.005° (~500 m) grid, place/taluka enrichment from village geometries, 5-minute per-source de-duplication. The **tier is re-assigned from the registry** (`packages/schema/src/sources.ts`), so a feed can't promote itself. |
| **3 Store** | `apps/edge/src/store/{neon,memory}.ts` | Neon (durable) or the in-memory store. The phone caches the last ranking and every opened detail in IndexedDB (Dexie). |
| **4 Fuse** | `packages/fusion/src/engine.ts` → `computeScore` | Per location: recency, agreement and reliability components. |
| **5 Rank** | `engine.ts` → `rank` | Linear formula, bands, sort. |
| **6 Explain** | `packages/fusion/src/explain.ts` | Plain-English reason from the top three signal types in tier order, with stale and conflict prefixes. |

## Fusion — the confidence formula

```
Score = 0.35 × recency + 0.45 × agreement + 0.20 × reliability     (0–100)
High ≥ 70 · Medium 40–69 · Low < 40
```

All numbers live in **`packages/fusion/weights.yaml`**, the single runtime source of truth. It is served verbatim at `GET /weights` so anyone can audit it.

| Component | Definition |
|---|---|
| **recency** | max over contributing events of `exp(−age / half_life[source])` |
| **agreement** | `min(1, n / 4)`. Each distinct **tier** reporting counts 1.0; each further report from an already-counted tier counts 0.5 (`same_tier_report_weight`). Counted over signals within 60 min of the *newest* contributing signal. All-clear ("safe") reports are counted the same way and subtracted. |
| **reliability** | mean of tier weights (T1 1.0 · T2 0.85 · T3 0.6 · T4 0.35), weighted by each signal's recency |
| **contributing events** | a signal contributes while its recency weight is ≥ 0.25 (~1.4 half-lives), top 12 per location. A location with none left keeps its single freshest signal and is marked **Stale**. |

### Interpretation choices (the spec left these open)

The spec's worked example (Village A = 87, Village B ≈ 17) only comes out right under specific readings of §9.2. We chose these and recorded each one in `weights.yaml`:

1. **Agreement window is relative to the newest signal, not the wall clock.** Under the wall-clock reading, Village B's 3-hour-old SMS would get zero agreement and score 7, not ≈17. Absolute staleness is recency's job.
2. **Same-tier reports count 0.5.** With `independence_by: tier` taken literally, Village A has only two tiers (0.5 agreement) and scores 64. Counting further same-tier reports at half weight gives 1.0 agreement, which reproduces 87.
3. **Reliability is recency-weighted.** An unweighted mean gives 86. The recency-weighted mean gives exactly **87**.

Golden test (merge blocker, `packages/fusion/src/engine.test.ts`): Village A → **87 High**; Village B → **18 Low** (range 14–20).

## Reliability tiers

| Tier | Sources |
|---|---|
| T1 | CWC river gauges, NWDP, USGS |
| T2 | Sentinel-1 SAR, Sentinel-2, CEMS GFM, NASA FIRMS |
| T3 | OpenWeather, IMD, OSM road status, GDACS |
| T4 | Citizen SMS (Twilio, MSG91), DISCOM outages |

## Adapters — status

| Adapter | Status | Note |
|---|---|---|
| `usgs_quake.py` | **Live** | Real feed; fixture is a real capture |
| `gdacs.py` | **Live** | `EVENTS4APP` endpoint; fixture is a real capture |
| `firms.py` | **Live, needs key** | `FIRMS_MAP_KEY` |
| `openweather.py` | **Live, needs key** | One Call 3.0, 12 poll points, >25 mm/h → `heavy_rain` |
| `overpass.py` | **Live** | Reachability score from OSM road tags. OSM rarely carries real-time closures, so treat it as a weak signal |
| `sentinel1.py` | **Built, needs `[sar]` extra** | dask-flood-mapper → 500 m cells, zarr cache under `/data/s1` |
| `sms-webhook` (edge) | **Live** | Twilio signature verified, MSG91 token, PII stripped, idempotent on message id |
| `sentinel2`, `cems_gfm`, `imd`, `cwc_wris`, `nwdp` | **Not built** | Declared in `adapters/_stubs.py`; each reports "not built" instead of inventing data |
| `discom_outage` | **Mock** | No machine-readable CESC/BESCOM feed; the replay supplies outage windows |

## SMS ingest

Feature phones can't send GPS, so a message is located by, in order: (1) coordinates in the body, (2) a village name, (3) a pre-registered volunteer's hashed number. Messages that can't be located get a reply asking for the village name, and are not stored. Polarity: "safe / water gone down / road open" → all-clear, unless negated ("not safe"). The sender number is stored only as a salted SHA-256 prefix, and phone-number-like strings are removed from the body.

## Offline

| Layer | Strategy |
|---|---|
| App shell | Workbox precache |
| `/rankings` | Network-first, 3 s timeout. The client also keeps the last ranking in Dexie and detects SW-served stale bodies from `computed_at_utc` |
| `/recommendation/:id` | **Network-first, 3 s** (spec said stale-while-revalidate, which showed the previous evidence right after a new SMS). Also cached in Dexie |
| `/kodagu.pmtiles` | Cache-first, range requests served from the cached file |

Banners follow spec §10.3 exactly (`apps/web/src/status.ts`, unit-tested).

## Replay (Kodagu, August 2018)

`packages/kodagu-fixtures` generates a deterministic scenario (fixed seed) and compiles it through the same Normalize stage. The edge replays it with a looping clock: `sim = 09:00 IST 16 Aug 2018 + ((wall − anchor) mod 3 min) × 60`. The clock is stateless, so every Worker isolate agrees on the sim time. `POST /replay/restart` jumps back to the first frame for a video take. Live SMS during a replay are stamped with sim time, so they fuse with the archive.

## Deviations from the build spec

| Spec | Built | Why |
|---|---|---|
| Replayer in Python (`workers/python/replayer`) | TypeScript, in `packages/kodagu-fixtures` + edge clock | Runs with just `pnpm dev`, with no Fly/Neon needed, so the demo works offline on a laptop |
| Worker writes Neon via SQLAlchemy | Worker POSTs to edge `/ingest`; `db.py` only manages partitions | One Normalize stage, one tier registry, one place that wakes phones |
| Fusion engine copied into web + edge | One package, `packages/fusion` | One copy of the formula |
| `weights.yaml` in `apps/web/src/fusion/` or `config/` | `packages/fusion/weights.yaml` | The spec named two locations; picked one |
| `events.id` primary key | `(id, observed_at)` | Postgres requires the partition key in unique constraints on partitioned tables |
| deck.gl overlay | MapLibre circle layer | ~20 pins don't need deck.gl's weight |
| Turso Sync spine | **Not built**; Dexie + service worker provide offline | Spec risk log already names Dexie as source of truth; Turso adds a WASM runtime to the phone for no user-visible gain in v1 |
| vitest 2 | vitest 3 | vitest 2 doesn't support Vite 6 |
| `sms-webhook` wakes clients via SSE | SSE works within one process (Node server, `wrangler dev`). On multi-isolate Workers the client's 5 s poll is the fallback | A Durable Object would make SSE global; on the roadmap |
| Landslides in fixtures | Surfaced as `road_impassable` (cause: landslide) | `EventType` has no landslide type; road closure is how a landslide reaches a responder |
