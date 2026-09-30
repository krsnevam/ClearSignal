# Running ClearSignal on any device

This guide gets ClearSignal running on your computer and opens it on a laptop, phone or tablet. It needs no accounts or API keys: the app replays the Kodagu floods of August 2018 from data bundled in the repo.

You run two small servers on one computer (the **host**):

| Server | Port | What it is |
|---|---|---|
| API | 8787 | Ranks villages, receives SMS, replays the 2018 scenario |
| Web app | 5173 | The ClearSignal app itself. It forwards `/api/*` to the API, so **other devices only need this one address** |

---

## 1. Install the prerequisites (host computer only)

You need **Node.js 22 or newer** and **git**. Nothing else is needed for the app.

| OS | Commands |
|---|---|
| **Windows 10/11** | Install Node.js 22 LTS from <https://nodejs.org> and Git from <https://git-scm.com>. Then, in **PowerShell as Administrator**: `corepack enable` |
| **macOS** | `brew install node@22 git` then `corepack enable` |
| **Ubuntu / Debian** | `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo -E bash - && sudo apt install -y nodejs git` then `sudo corepack enable` |

Check with `node -v`, which should print `v22.x` or higher.

> If `corepack enable` fails with a permissions error, run `npm install -g pnpm@9` instead.

## 2. Get the code and install

```bash
git clone <your-repo-url> clearsignal
cd clearsignal
pnpm install
```

Create your local settings file (the defaults work as-is):

```bash
cp .env.example .env          # macOS / Linux / Git Bash
copy .env.example .env        # Windows PowerShell or cmd
```

## 3. Start it (two terminals)

**Terminal 1: API**
```bash
pnpm --filter edge dev:node
```
Wait for `ClearSignal API on http://localhost:8787 · store=memory · scenario=kodagu-2018`.

**Terminal 2: web app**
```bash
pnpm --filter web dev
```
It prints two addresses:
```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.x.x:5173/
```

Leave both terminals running. Press `Ctrl+C` in each to stop.

## 4. Open it

### On the host computer
Open **http://localhost:5173**.

To see the phone layout in Chrome or Edge, press `F12`, then `Ctrl+Shift+M` (`Cmd+Shift+M` on a Mac), and pick a phone such as "Pixel 7".

### On a phone or tablet on the same Wi-Fi
1. Connect the device to the **same Wi-Fi** as the host.
2. Open the **Network** address from Terminal 2, e.g. `http://192.168.1.45:5173`.
3. Nothing loads? Let Node.js through the host's firewall:
   - **Windows:** click "Allow access" on the Windows Defender prompt, or allow `node.exe` on *Private networks*.
   - **macOS:** System Settings → Network → Firewall → allow `node`.
   - **Linux (ufw):** `sudo ufw allow 5173/tcp`.
   - Guest and office Wi-Fi often block devices from reaching each other. Use a phone hotspot or the tunnel in step 5.

Over plain `http://` on a network address, the app works but **can't be installed and won't work offline**. Browsers only allow those on `https://` or `localhost`. For that, use step 5.

### On any device, anywhere, as an installable app (HTTPS)
Offline mode and "Add to Home screen" need HTTPS and the production build.

**Terminal 2** (instead of `dev`):
```bash
pnpm --filter web build
pnpm --filter web preview          # serves the built app on port 4173
```

**Terminal 3: temporary public HTTPS address** (free, no account):
```bash
npx cloudflared tunnel --url http://localhost:4173
```
It prints an address like `https://random-words.trycloudflare.com`. Open it on any device, anywhere, then:
- **Android (Chrome):** menu ⋮ → *Install app* / *Add to Home screen*
- **iPhone (Safari):** Share → *Add to Home Screen*

> ⚠ Anyone who has that link can open your running copy while the tunnel is up. Stop it with `Ctrl+C` when you're done. The replay data is synthetic, but the SMS endpoint is also reachable through the link.

---

## 5. Try the demo

The replay starts at **09:00 IST, 16 Aug 2018** and runs at 60×, so one real minute is one hour of the scenario. It loops every 3 minutes.

**Send a citizen SMS** (the "one text" moment). Watch the Bhagamandala card update within seconds:

```bash
# macOS / Linux / Git Bash
curl -X POST http://localhost:5173/api/sms-webhook -H "content-type: application/json" \
  -d '{"sender":"919900000000","message":"Bhagamandala flooded near school"}'
```
```powershell
# Windows PowerShell
Invoke-RestMethod -Method Post -Uri http://localhost:5173/api/sms-webhook -ContentType 'application/json' `
  -Body '{"sender":"919900000000","message":"Bhagamandala flooded near school"}'
```

**Create a conflict:** send `"Bhagamandala water gone down we are safe"`. The card shows *Sources disagree* and lists both sides.

**Restart the replay** at 09:00 (the token is `INGEST_TOKEN` in `.env`):
```bash
curl -X POST http://localhost:5173/api/replay/restart -H "authorization: Bearer dev-ingest-token"
```
```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5173/api/replay/restart -Headers @{ authorization = 'Bearer dev-ingest-token' }
```

**Airplane mode:** open the HTTPS/preview version once, then turn on airplane mode, or in DevTools choose Network → *Offline*. The list stays, and a blue *Offline · showing last data from HH:MM* banner appears.

**Language:** tap ⚙ (top right) → *Language* → English, ಕನ್ನಡ or हिन्दी. Phones set to Kannada or Hindi start in that language.

**Presenter controls:** tap ⚙ (top right) → *Presenter* to pause, switch between 1×, 60× and 300×, or restart at 09:00. The same sheet has Night/Sunlight themes, Large text, "How scores work" and **drill mode**. To make 1× the default speed, set `REPLAY_SPEED=1` in `.env` and restart Terminal 1.

**Send to team:** open any village → *Send to team* / *SMS* / *Copy* produces a ready dispatch message.

---

## 6. Optional extras

### Detailed offline map (roads, rivers, towns)
The 14 MB Kodagu map file isn't in git. Without it, the Map tab shows village pins on a plain background.

1. Install the `pmtiles` tool:
   - **macOS:** `brew install pmtiles`
   - **Windows / Linux:** download from <https://github.com/protomaps/go-pmtiles/releases> and put `pmtiles` (or `pmtiles.exe`) on your PATH.
2. From the repo folder:
   ```bash
   ./scripts/build-pmtiles.sh                 # macOS / Linux / Git Bash
   ```
   ```powershell
   # Windows PowerShell: replace the date with yesterday's date (YYYYMMDD)
   pmtiles extract https://build.protomaps.com/20260929.pmtiles apps/web/public/kodagu.pmtiles --bbox=75.4,11.9,76.2,12.9 --maxzoom=15
   ```
3. Refresh the app.

### Run the tests
```bash
pnpm -r test                               # unit tests + Village A/B golden test
pnpm --filter web exec playwright install chromium
pnpm --filter web test:e2e                 # 3G load, airplane mode, SMS → card, conflict
```

### Live data sources (Python worker)
Needs Python 3.10+ (3.12 recommended):
```bash
cd workers/python
python -m venv .venv
source .venv/bin/activate                  # Windows: .venv\Scripts\activate
pip install '.[dev]'
INGEST_TOKEN=dev-ingest-token python -m scheduler --once
```
USGS, GDACS and OpenStreetMap work without keys. Add `OPENWEATHER_API_KEY` and `FIRMS_MAP_KEY` to `.env` for weather and fire data. With `REPLAY_MODE=off` in `.env`, the app shows only live data.

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| **The list stays on "Loading ranked villages…"** | The API isn't running. Check Terminal 1, and open <http://localhost:5173/api/health>, which should show `{"ok":true}` |
| **`ENOSPC: System limit for number of file watchers reached`** (Linux) | `sudo sysctl fs.inotify.max_user_watches=524288`, or run with polling: `CHOKIDAR_USEPOLLING=1 pnpm --filter web dev` |
| **`Port 8787 / 5173 is already in use`** | Another copy is running. Close it, or find it with `lsof -i :5173` (macOS/Linux) or `netstat -ano \| findstr 5173` (Windows) |
| **Phone shows "site can't be reached"** | Same Wi-Fi? Firewall allowed (step 4)? Otherwise use the tunnel |
| **"Blocked request. This host is not allowed"** | You're using a tunnel service other than cloudflared, ngrok or localtunnel. Add its domain to `tunnelHosts` in `apps/web/vite.config.ts` |
| **Map is a plain background** | Expected without the map file. See *Detailed offline map* |
| **Install or offline doesn't work** | Needs HTTPS and the preview build (`build` + `preview` + tunnel), not `dev` |
| **`pnpm: command not found`** | Run `corepack enable`, or `npm install -g pnpm@9` |
| **`pnpm --filter edge dev` (wrangler) fails with `GLIBC_2.3x not found`** | Cloudflare's local runtime needs a newer Linux. Use `dev:node`, which runs the same API on Node |
| **Changes don't hot-reload on Windows/WSL** | Keep the repo inside the WSL filesystem (`~/…`), not `/mnt/c/…` |
