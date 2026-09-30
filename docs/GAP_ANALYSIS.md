# Gap analysis: what a winning submission needs

Reviewed against the five judged criteria (`buildSpec.md` §1.1), the evidence checklist (§19), and the reviewer profile (§1.2: five of seven reviewers are non-engineers). **Status:** ✅ done in the repo · 🟡 partly done · 🔴 needs you (accounts, people, filming).

## 1. Timeliness, real-time responsiveness & technical reliability

| Gap | Status | What we did |
|---|---|---|
| Per-source latency visible in the UI (the spec's own score angle) | ✅ | Sources tab shows each source's typical observation→arrival delay and 24 h volume (`median_latency_seconds`, `events_24h`) |
| Three named failure modes with mitigations | ✅ | Four, in the app (Sources → "What breaks, and what happens") and in [ARCHITECTURE.md](ARCHITECTURE.md#failure-modes): network loss, silent feed, contradictory reports, spam/spoofed SMS |
| SMS flood / spoofing | ✅ | Per-sender rate limit, tested |
| Timings measured on the target phone | 🔴 | e2e shows < 3 s load and < 4 s SMS→card on a laptop. Re-measure on a Galaxy A54 before quoting |

## 2. Comprehensiveness, available data & novel data discovery

| Gap | Status | What we did |
|---|---|---|
| Feature-phone SMS only understood English | ✅ | Kannada script (ಭಾಗಮಂಡಲ, ಸುರಕ್ಷಿತ) and romanised Kannada ("neeru kammi", "surakshita") village names and safe/unsafe keywords, tested. **Verify with a native speaker** |
| No reply to the citizen | ✅ | Acknowledgement SMS ("flood report for Bhagamandala received… text SAFE when the water goes down"). This closes the loop and invites the all-clear |
| Live CWC / IMD / GFM / Sentinel-2 feeds | 🔴 | Need accounts. The replay supplies them, and REALIZATION.md says so |

## 3. Integration, synthesis quality & responsible data handling

| Gap | Status | What we did |
|---|---|---|
| Responsible-data policy | ✅ | [DATA_POLICY.md](DATA_POLICY.md): what's collected, hashing, retention, DPDP Act 2023 §7(h) disaster-response legitimate use, DLT |
| Security headers | ✅ | API: `secureHeaders`. Site: strict CSP, HSTS, permissions policy (`apps/web/public/_headers`) |
| In-app transparency for non-analysts | ✅ | "How scores work" sheet, built from the live `weights.yaml` values |
| Weights editable by file, auditable | ✅ | Already there. `GET /weights` |

## 4. Usability, clarity & operational readiness

| Gap | Status | What we did |
|---|---|---|
| No way to act on a decision | ✅ | **Send to team**: one tap produces a ready SMS/WhatsApp dispatch (priority, confidence, reason, caution, maps link). The SMS path works with no data connection |
| Night shifts and outdoor glare | ✅ | Options → Day / **Night** / **Sunlight** themes and **Large text**, remembered per phone. Night mode switches the map too |
| First-time users | ✅ | One-line "Top card = help first · How scores work" hint, dismissible |
| Evidence for the 90-second drill | ✅ tool · 🔴 run | **Drill mode**: hand-over screen, timer, record correct/reason, median, CSV export. Restarts the replay so every participant sees the same moment. *The drill itself needs volunteers* |
| Accessibility proof | ✅ | Automated axe scan (WCAG 2 A/AA) in e2e: zero serious or critical violations on four screens |
| Officers who don't read English; teams from outside Karnataka | ✅ | **English, ಕನ್ನಡ, हिन्दी UI** (Options → Language, auto-detected from the phone). Reasons, change feed, signal summaries and dispatch messages are built per language from structured data. Kannada shows Kannada-script village names. Fonts bundled offline. Adding a language = one dictionary file. **Needs native-speaker review** |
| Judges on laptops (risk log §20) | ✅ | ≥ 1024 px: list and map side by side, details as a right-hand drawer |

## 5. Scenario fit, insight & innovation

| Gap | Status | What we did |
|---|---|---|
| Situational awareness is about *change* | ✅ | "Latest changes" feed: band rises/falls, new villages, conflicts appear or clear, new reports. Tap an entry to open that village |
| Presenter control for video and live demo | ✅ | Options → Presenter: pause, 1×/60×/300×, restart at 09:00 IST. Open locally, token-locked in production (`DEMO_CONTROLS`) |

## Evidence checklist (§19)

See [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md) for item-by-item status and portal-field guidance.

## Deliberately not added (scope discipline, §1.4)

User accounts, a command-center dashboard, push notifications and ML models. Each would cost days and none raises a judged score as much as the drill and the video.
