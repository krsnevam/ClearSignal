# Submission checklist

The IEEE Response Quest evidence checklist (`buildSpec.md` §19), with where each item stands. ✅ ready · 🔴 needs you.

## Evidence a judge clicks through

| # | Item | Status | Where / what's left |
|---|---|---|---|
| 1 | Live PWA, installable, works offline | 🔴 | Code is ready and tested (install, offline reload, SW caching). **Deploy:** register `clearsignal.app`, create Cloudflare Pages + Workers, run `./scripts/deploy.sh`. In `apps/web/public/_headers`, keep `connect-src` in step with the API URL |
| 2 | 3-minute video with the three moments | 🔴 | Shot list: [VIDEO_STORYBOARD.md](VIDEO_STORYBOARD.md). Use Options → Presenter (1×, restart) while filming |
| 3 | `REALIZATION.md` (real vs simulated vs next) | ✅ | [REALIZATION.md](REALIZATION.md). Update the timing rows after measuring on the A54 |
| 4 | `ARCHITECTURE.md` with the six-stage pipeline | ✅ | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 5 | `DRILL_PROTOCOL.md` with photos, raw times, median | 🟡 | Protocol + in-app **drill mode** ready. **Run it with 5–8 volunteers**, then paste the exported CSV into [DRILL_PROTOCOL.md](DRILL_PROTOCOL.md) |
| 6 | `AI_USAGE.md` truthful and specific | ✅ | [AI_USAGE.md](AI_USAGE.md). Add any other tools you actually use |
| 7 | Rules-acceptance checkbox | 🔴 | Portal |
| 8 | Product Video Type = "Hosted Elsewhere" + unlisted YouTube URL | 🔴 | Portal |
| 9 | Submit for Review = Yes | 🔴 | Portal, on the final day |

## Supporting documents to upload

Upload as "Additional Product-Related Documents", in this order. Judges read the first ones most.

1. `REALIZATION.md`: the one-page story and numbers
2. `DATA_POLICY.md`: responsible data (criterion 3; the Legal & Compliance reviewer will look for this)
3. `ARCHITECTURE.md`: pipeline, formula, failure modes
4. `DRILL_PROTOCOL.md`: once run
5. `AI_USAGE.md`
6. Slide deck (5–7 slides, §17.5): **not built yet**

## Before you submit: verify

- [ ] `pnpm -r test`, `pnpm --filter web test:e2e` and `pytest` all green on the release commit
- [ ] Live URL opens on a phone over mobile data, installs, and works in airplane mode
- [ ] Live site has presenter controls **locked** (`DEMO_CONTROLS=off` in `wrangler.toml`)
- [ ] The QR code in the video's closing frame opens the live URL
- [ ] SMS to the real number shows up on the live site in < 4 s
- [ ] Kannada and Hindi UI (`apps/web/src/i18n/kn.ts`, `hi.ts`), village names and SMS keywords checked by native speakers
- [ ] Every number quoted in the video matches REALIZATION.md

## Recommended order for the human work

1. Deploy (half a day) → 2. measure on the A54 and update REALIZATION → 3. run the drill (2 h with 8 people) → 4. film (use the storyboard beats) → 5. deck → 6. portal.
