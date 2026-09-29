#!/usr/bin/env bash
# First-run setup (spec §6.2). Safe to re-run.
#   1. .env from .env.example (prompts for keys you have; blank = skip)
#   2. Neon: apply migrations + seed sources/villages   (if DATABASE_URL set)
#   3. Turso: create clearsignal-dev                    (if turso CLI present)
#   4. Build the Kodagu 2018 fixtures
#   5. Download the Kodagu PMTiles basemap clip         (if pmtiles CLI present)
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
  if [[ -t 0 ]]; then
    for key in DATABASE_URL OPENWEATHER_API_KEY FIRMS_MAP_KEY IMD_API_KEY TWILIO_AUTH_TOKEN COPERNICUS_CLIENT_ID COPERNICUS_CLIENT_SECRET; do
      read -r -p "$key (blank to skip): " val
      [[ -n "$val" ]] && sed -i.bak "s|^$key=.*|$key=$val|" .env
    done
    rm -f .env.bak
  fi
fi
set -a; source .env; set +a

pnpm install
node scripts/make-icons.mjs apps/web/public/icons
pnpm --filter @clearsignal/kodagu-fixtures build

if [[ -n "${DATABASE_URL:-}" ]]; then
  node --import tsx --import ./scripts/register-yaml.mjs scripts/seed-kodagu.ts
else
  echo "DATABASE_URL empty — edge will use the in-memory store (replay demo still works)."
fi

if command -v turso >/dev/null; then
  turso db show clearsignal-dev >/dev/null 2>&1 || turso db create clearsignal-dev --location bom
else
  echo "turso CLI not found — skipping (Dexie is the on-device source of truth; see docs/ARCHITECTURE.md)."
fi

if command -v pmtiles >/dev/null; then
  ./scripts/build-pmtiles.sh
else
  echo "pmtiles CLI not found — map tab will show pins on a plain background until you run scripts/build-pmtiles.sh."
fi

echo
echo "Ready. In two terminals:"
echo "  pnpm --filter edge dev:node    # API on :8787 (Node; use 'dev' for wrangler/workerd)"
echo "  pnpm --filter web dev          # PWA on :5173"
