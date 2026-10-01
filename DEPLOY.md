# Deploying ClearSignal

**Live now:** app **https://clearsignal-app.pages.dev** · API **https://clearsignal-api.clearsignal.workers.dev** (deployed 2026-10-01; `workers.dev` subdomain `clearsignal`; secrets in the git-ignored `.env.production.local`).

This gets the judge-facing site live. The fastest path takes about 20 minutes, is free, and needs no domain: the app goes on `*.pages.dev` and the API on `*.workers.dev`. You can add `clearsignal.app` afterwards without redeploying anything else.

| Piece | Where | Needed for the demo? |
|---|---|---|
| Web app (PWA) | Cloudflare Pages | **Yes** |
| API + 2018 replay | Cloudflare Workers | **Yes** |
| Custom domain | Cloudflare Registrar | Recommended (QR code, `.app` HSTS) |
| Real SMS number | Twilio | For the "one text" video moment |
| Database | Neon Postgres | For SMS in production (see step 5) |
| Live-data worker | Fly.io | Optional: the replay covers the demo |

You need a free Cloudflare account and the repo set up as in [RUNNING.md](RUNNING.md) (`pnpm install` works).

---

## 1. Log in to Cloudflare (once)

```bash
npx wrangler login          # opens a browser; approve access
npx wrangler whoami         # should show your account
```

## 2. Deploy the API

```bash
cd apps/edge
npx wrangler secret put INGEST_TOKEN      # any long random string; keep it, it unlocks presenter controls
npx wrangler secret put SMS_HASH_SALT     # another long random string, never change it afterwards
npx wrangler deploy
cd ../..
```

`wrangler deploy` prints the API address, e.g. `https://clearsignal-api.<your-subdomain>.workers.dev`. Check it:

```bash
curl https://clearsignal-api.<your-subdomain>.workers.dev/health      # {"ok":true}
```

The production API runs the Kodagu 2018 replay with presenter controls **locked** (`DEMO_CONTROLS = "off"` in `wrangler.toml`). To use them on the live site, send the token: `curl -X POST <API>/replay/restart -H "authorization: Bearer <INGEST_TOKEN>"`.

## 3. Build the offline map (once, ~30 s)

The 14 MB Kodagu basemap isn't in git. Skip this and the map shows pins on a plain background.

The app downloads the file once on first map open (with a progress bar) and reads tiles from memory. Cloudflare Pages ignores HTTP `Range` requests, so the usual tile-by-tile reading would re-download all 14 MB per tile. The service worker then caches the file, and the map works fully offline.

```bash
./scripts/build-pmtiles.sh      # needs the pmtiles CLI, see RUNNING.md § Detailed offline map
```

## 4. Deploy the web app

```bash
npx wrangler pages project create clearsignal-app --production-branch main     # first time only
API_URL=https://clearsignal-api.<your-subdomain>.workers.dev ./scripts/deploy.sh
```

`deploy.sh` runs the tests, redeploys the API, builds the app pointed at `API_URL`, and uploads it. The build also writes `API_URL` into the site's security policy, so the app is allowed to call it. Open **https://clearsignal-app.pages.dev** on your phone: it should show the ranked list, and ⚙ → Install should work.

> Using a different Pages project name? Add its `https://<name>.pages.dev` to `ALLOWED_ORIGINS` in `apps/edge/wrangler.toml` and redeploy, or the browser will block the API calls (CORS).

**Rollback:** `git checkout <last-good-commit>` and run the same command again.

## 5. SMS: the "one text" moment

Cloudflare runs the API as several independent copies (isolates). Without a database, an SMS stored by one copy may not be visible to another. Pick one option:

**A. For the video shoot (simplest, reliable):** run the API on your laptop and give Twilio a tunnel address.
```bash
pnpm --filter edge dev:node                             # terminal 1
npx cloudflared tunnel --url http://localhost:8787      # terminal 2 → https://xyz.trycloudflare.com
```
Film with the web app pointed at that API: `API_URL=https://xyz.trycloudflare.com pnpm --filter web build && pnpm --filter web preview`, and open it through a second tunnel to port 4173. Or film on `localhost` directly.

**B. For the live site:** add Neon Postgres (free tier, Mumbai region).
```bash
# create a Neon project, copy its connection string, then:
DATABASE_URL='postgres://…' node --import tsx --import ./scripts/register-yaml.mjs scripts/seed-kodagu.ts --with-replay
cd apps/edge && npx wrangler secret put DATABASE_URL && npx wrangler deploy
```

**Then point Twilio at it:** Twilio Console → Phone Numbers → your number → *Messaging* → "A message comes in" → Webhook, `POST`, `https://<API>/sms-webhook`. Then:
```bash
cd apps/edge
npx wrangler secret put TWILIO_AUTH_TOKEN        # from the Twilio console; enables signature checks
npx wrangler secret put PUBLIC_WEBHOOK_URL       # exactly the URL you gave Twilio
```
Text "Bhagamandala flooded near school" to the number. The card should update within 4 s.

India note: inbound SMS on Indian numbers at scale needs DLT registration (use MSG91). For the video, a US Twilio number works (`buildSpec.md` §20).

## 6. Custom domain (clearsignal.app)

1. Cloudflare dashboard → *Domain Registration* → register `clearsignal.app` (about $10/yr). `.app` forces HTTPS, which is what an installable PWA needs.
2. *Workers & Pages* → `clearsignal-app` → *Custom domains* → add `clearsignal.app`.
3. In `apps/edge/wrangler.toml`, uncomment `routes = [{ pattern = "api.clearsignal.app", custom_domain = true }]`, then:
   ```bash
   API_URL=https://api.clearsignal.app ./scripts/deploy.sh
   ```
4. Update the Twilio webhook and `PUBLIC_WEBHOOK_URL` to `https://api.clearsignal.app/sms-webhook`.

## 7. Optional: live-data worker (Fly.io, Mumbai)

```bash
cd workers/python
fly launch --no-deploy --copy-config          # uses fly.toml (region bom)
fly secrets set INGEST_TOKEN=<same as step 2> EDGE_INGEST_URL=https://<API>/ingest \
  OPENWEATHER_API_KEY=… FIRMS_MAP_KEY=…
fly deploy
```
Only useful with `REPLAY_MODE = "off"` or a Neon database. The demo doesn't need it.

## 8. Optional: deploy on every push (GitHub Actions)

`.github/workflows/deploy.yml` runs tests, builds and deploys on each push to `main`. In the GitHub repo settings, set:
- **Secrets:** `CF_API_TOKEN` (Cloudflare API token with *Workers Scripts* + *Pages* edit), `CF_ACCOUNT_ID`, `FLY_API_TOKEN` (only if using step 7).
- **Variables:** `API_URL` (the address from step 2 or 6).

## After deploying: check

- [ ] `https://<API>/health` returns `{"ok":true}`, and `/weights` shows the YAML
- [ ] The site loads on a phone over mobile data; ⚙ → Install works; airplane mode keeps the list
- [ ] Map tab shows roads and rivers (the basemap was included)
- [ ] ⚙ → Language switches to ಕನ್ನಡ and हिन्दी
- [ ] A test SMS reaches the card (if step 5 is done)
- [ ] Presenter controls are locked on the live site (⚙ → Presenter says "Locked")
