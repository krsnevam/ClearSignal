# ClearSignal — Product Realization

**IEEE Response Quest · Impact Challenge submission #5391 · "Turning Conflicting Signals Into Trusted Action"**

## What we built

ClearSignal is an installable, offline-first phone app that answers one question for a Karnataka SDMA field coordinator: *which villages need evacuation support first, and how much should I trust that answer?* It fuses satellite flood maps, river gauges, rainfall, road closures, power outages and citizen SMS from basic feature phones into a single ranked list. Each village carries a confidence score, a plain-English reason, the age of its oldest signal, and an explicit flag when sources disagree. The scoring is a published, three-part linear formula, with no machine learning and no black box.

## What is real and what is simulated

| Element | Status |
|---|---|
| Ranking, confidence formula, explanations, offline behaviour, SMS webhook (English + Kannada), dispatch messages, drill mode | **Real, running code**, with automated tests |
| Village A = 87 / Village B = 18 worked example | **Real**: a merge-blocking test runs the production function |
| USGS, GDACS, FIRMS, OpenWeather, OSM adapters | **Real integrations** (FIRMS/OpenWeather need API keys) |
| Sentinel-1 SAR flood mapping | **Real integration** (TU Wien / interTwin dask-flood-mapper); needs the SAR extra installed |
| Sentinel-2, Copernicus GFM, IMD, CWC, NWDP live feeds | **Not yet integrated**. Supplied by the replay |
| Kodagu August 2018 replay | **Reconstructed.** Daily rainfall totals and the count of 105 landslides follow the published record. Landslide positions, gauge levels, outage windows and satellite detections are reconstructed around the documented affected villages, not transcribed from source bulletins |
| Citizen SMS in the replay | **Synthetic** (24 messages), labelled as such in the data |
| DISCOM power outages | **Mock adapter.** No machine-readable feed exists |

## Live URL and the three moments

- **Live:** `https://clearsignal.app` *(pending domain registration and deploy)*
- **The one text:** a feature phone texts "Bhagamandala flooded near school"; the Bhagamandala card updates on screen.
- **Airplane mode:** the list stays, a blue banner reads *"Offline · showing last data from HH:MM"*, and it reconciles when back online.
- **Village A vs Village B:** 87 High vs 18 Low, from the same function the app runs.

## Numbers

| Measure | Result | How measured |
|---|---|---|
| Automated tests | 56 TypeScript + 9 Python + 6 end-to-end, all passing | `pnpm -r test`, `pytest`, `playwright test` |
| Accessibility | 0 serious or critical WCAG 2 A/AA violations on list, detail, options and sources | axe-core in the e2e suite |
| Per-source delay (replay) | CWC 10 min · NWDP 5 min · Sentinel-1 45 min · Copernicus GFM 3 h · SMS ~0 s | Shown live in the Sources tab |
| First recommendation, cold cache, throttled "Fast 3G" | under the 3 s budget (e2e test) | Playwright, Pixel 7 profile, desktop CPU. **Re-measure on a Galaxy A54 before quoting** |
| SMS received → card updated | under the 4 s budget (e2e test) | Playwright, local server. **Re-measure over the real Twilio number** |
| Live source classes | 6 hazard classes, 14 declared sources | `packages/schema/src/sources.ts` |
| 90-second comprehension drill | **Not yet run.** See `DRILL_PROTOCOL.md` | — |

## What's next

1. Run the comprehension drill with 8+ volunteers on a Galaxy A-series phone and publish the raw times.
2. Integrate the CWC/NWDP gauge feeds and Copernicus GFM so river and satellite signals are live, not replayed.
3. Register an India-native inbound SMS route (MSG91 with DLT) so village volunteers can text a local number.

## Languages

The interface is available in **English, Kannada (ಕನ್ನಡ) and Hindi (हिन्दी)**. That covers Kodagu officers and volunteers, and national teams such as NDRF deployed from outside Karnataka. Explanations, change alerts and dispatch messages are generated natively in each language, not machine-translated. Citizen SMS are understood in all three. The Kannada and Hindi text is a draft awaiting native-speaker review.
