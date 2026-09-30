# Responsible data handling

ClearSignal ranks villages, not people. This page says what data it touches, what it keeps, and how it's protected. Each rule points to the code that enforces it.

## What we collect

| Data | From | Kept as | Why |
|---|---|---|---|
| Hazard observations (rain, river level, flood extent, road closures, outages) | Public agency feeds, listed in [ARCHITECTURE.md](ARCHITECTURE.md) | As published, with source and timestamp | The ranking itself |
| Citizen SMS text | Twilio / MSG91 webhook | Message with phone numbers **removed**, max 320 characters | Ground truth from villages without data coverage |
| Sender phone number | SMS webhook | **Never stored.** Replaced by a salted one-way code (`sha256:` + 16 hex characters) | Rate limiting and de-duplication only |
| Sender location | Village name or coordinates *typed in the message*, or a volunteer's pre-registered village | Village centroid | Place the report on the map |
| Responder activity | None | Nothing | The app has no accounts, no tracking and no analytics |

The app never reads the phone's GPS. Its browser permissions policy disables geolocation, camera and microphone (`apps/web/public/_headers`).

## Rules and where they're enforced

1. **Numbers are hashed, never stored.** `hashSender()` in `apps/edge/src/sms/parse.ts` salts with `SMS_HASH_SALT`, a secret that is set per deployment.
2. **Numbers typed inside messages are removed.** `stripPii()` replaces anything phone-shaped with `[number removed]`. A test checks that no raw number reaches storage (`apps/edge/src/app.test.ts`, "never stores the phone number").
3. **One sender can't dominate.** A limit of 5 messages per sender per 10 minutes (`SMS_RATE_LIMIT`) stops accidental floods and deliberate spoofing. Citizen reports also carry the lowest trust tier (T4), so even many SMS can't outweigh one river gauge.
4. **Trust tiers are fixed in code.** `packages/schema/src/sources.ts` sets them. The ingest endpoint overwrites any tier a feed claims (tested: "overrides the claimed tier").
5. **The formula is public.** `GET /weights` serves `weights.yaml` verbatim, and the app explains every score in plain English.
6. **No AI at runtime.** The ranking is a deterministic linear formula. SMS parsing uses fixed keyword rules. See [AI_USAGE.md](AI_USAGE.md).
7. **Transport and browser security.** HTTPS only (`.app` domains enforce HSTS). The API sends `nosniff`, frame-deny and CORP headers; the site sends a strict Content-Security-Policy.

## Retention

| Store | Keeps | Notes |
|---|---|---|
| Phone (IndexedDB) | Last ranking + opened village details | Replaced on every sync. Clearing site data removes it |
| Edge in-memory store (demo) | Until the process restarts | — |
| Neon Postgres (production) | Events partitioned by day | **Policy:** drop partitions older than 30 days after the event is closed; keep aggregated rankings for the after-action review. `ensure_event_partition()` creates the partitions; the drop job is a one-line cron (to add before a real deployment) |

## Legal fit (India)

- **Digital Personal Data Protection Act, 2023.** No phone number, name or precise personal location is stored, so a hashed sender code and a free-text hazard report are, at most, minimal personal data. Taking "measures to ensure safety of, or provide assistance or services to, any individual during any disaster" is a *legitimate use* that needs no consent under **Section 7(h)** of the Act (verify the clause with counsel). The SMS acknowledgement tells the sender their report was received.
- **TRAI / DLT.** Inbound SMS at scale in India needs a DLT-registered route. MSG91 is the India-native path; the video uses a Twilio number (see the risk log in `buildSpec.md` §20).

## Synthetic and reconstructed data

All 24 SMS in the 2018 replay are synthetic and marked `synthetic: true`. The replay's gauge levels, outage windows, satellite detections and landslide positions are reconstructed around the documented timeline and marked `reconstructed: true`. No real person's message or number appears anywhere in the repository.

*This is an engineering policy, not legal advice. Have it reviewed before deploying with a government partner.*
