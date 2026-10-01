# ClearSignal

**Which villages need evacuation support first, and how much should I trust that answer?**

ClearSignal is an offline-first PWA for disaster responders in Kodagu district, Karnataka. It fuses satellite, river-gauge, rainfall, road, power-outage and citizen-SMS signals into one ranked list. Each village gets a confidence score, a plain-English reason, the age of its oldest signal, and a flag when sources disagree.

IEEE Response Quest · Impact Challenge #5391. Full build spec: [`buildSpec.md`](buildSpec.md).

## Quick start (no accounts needed)

> **Step-by-step for Windows, macOS, Linux, phones and tablets: [RUNNING.md](RUNNING.md).**

```bash
corepack enable            # provides pnpm 9 (see packageManager in package.json)
pnpm install
pnpm --filter edge dev:node    # API on http://localhost:8787, replaying Kodagu Aug 2018 at 60×
pnpm --filter web dev          # PWA on http://localhost:5173
```

With no `DATABASE_URL`, the API runs on an in-memory store seeded with the 2018 replay, so everything works on a laptop.

Send a citizen SMS without Twilio:

```bash
curl -X POST localhost:8787/sms-webhook -H 'content-type: application/json' \
  -d '{"sender":"919900000000","message":"Bhagamandala flooded near school"}'
```

Restart the replay at its first frame (09:00 IST, 16 Aug 2018):

```bash
curl -X POST localhost:8787/replay/restart -H "authorization: Bearer $INGEST_TOKEN"
```

Full first-run setup with real services: `./scripts/bootstrap.sh` (see [`.env.example`](.env.example)).

## What it does

- **Ranked list** with a confidence score, plain-English reason, oldest-signal age, and a *Sources disagree* flag
- **Why this score:** the three parts (fresh, agreement, trust) as one bar that adds up to the score
- **Send to team:** one-tap dispatch by SMS, WhatsApp or share, working with no data connection
- **Latest changes** feed, **offline** mode, **map** with an offline Kodagu basemap, **desktop** two-pane layout
- **Citizen SMS** from any phone, in English, Kannada or Hindi, rate-limited and acknowledged
- **English · ಕನ್ನಡ · हिन्दी** interface, with Kannada-script village names
- **Options:** Night / Sunlight themes, Large text, "How scores work", presenter controls, **drill mode**

## Documents

| For | Read |
|---|---|
| Running it anywhere | [RUNNING.md](RUNNING.md) |
| Putting it online | [DEPLOY.md](DEPLOY.md) |
| What's real vs simulated | [docs/REALIZATION.md](docs/REALIZATION.md) |
| How it works, failure modes | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Responsible data | [docs/DATA_POLICY.md](docs/DATA_POLICY.md) |
| Gaps closed and what's left | [docs/GAP_ANALYSIS.md](docs/GAP_ANALYSIS.md) · [docs/SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md) |
| Video, drill, AI disclosure | [docs/VIDEO_STORYBOARD.md](docs/VIDEO_STORYBOARD.md) · [docs/DRILL_PROTOCOL.md](docs/DRILL_PROTOCOL.md) · [docs/AI_USAGE.md](docs/AI_USAGE.md) |

## Repository

```
apps/web                 PWA: React 19, Tailwind 4, MapLibre + PMTiles, Workbox, Dexie
apps/edge                API: Hono on Cloudflare Workers (or Node for local/video shoot)
packages/schema          zod contracts + source/tier registry shared by web and edge
packages/fusion          confidence engine, normalizer, explain(), weights.yaml
packages/db-schema       drizzle schema + SQL migration for Neon
packages/kodagu-fixtures Kodagu 2018 scenario generator, fixtures, replay clock
workers/python           adapters (USGS, GDACS, FIRMS, OpenWeather, Overpass, Sentinel-1) + scheduler
docs/                    ARCHITECTURE, REALIZATION, AI_USAGE, DRILL_PROTOCOL, VIDEO_STORYBOARD
scripts/                 bootstrap, seed, PMTiles clip, deploy, icons
```

## The formula

```
Score = 0.35 × recency + 0.45 × agreement + 0.20 × reliability     High ≥ 70 · Medium 40–69 · Low < 40
```

Weights live in [`packages/fusion/weights.yaml`](packages/fusion/weights.yaml) and are served at `GET /weights`. The golden test (Village A → **87 High**, Village B → **18 Low**) blocks merges. How the spec's open questions were resolved: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#interpretation-choices-the-spec-left-these-open).

## Tests

```bash
pnpm -r test                                   # unit + golden (vitest)
pnpm --filter web test:e2e                     # Playwright: 3G cold load, airplane mode, SMS → card, conflict
cd workers/python && pip install '.[dev]' && pytest
pnpm lint && pnpm -r typecheck
```

## Deploy

`./scripts/deploy.sh [staging]`, or push to `main` (`.github/workflows/deploy.yml`). Needs Cloudflare (Pages + Workers), Fly.io and, optionally, Neon.

## Honesty notes

The 2018 replay is **reconstructed**: rainfall totals and the landslide count follow the record, while positions and timings are rebuilt around documented affected villages. All replay SMS are **synthetic**. See [`docs/REALIZATION.md`](docs/REALIZATION.md) for what is real vs simulated.
