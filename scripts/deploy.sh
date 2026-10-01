#!/usr/bin/env bash
# One-command deploy (also the rollback path: check out the last good commit and re-run).
# See DEPLOY.md. Needs: `npx wrangler login` done once.
# Pages deploys run from apps/web: wrangler refuses to auto-detect from a monorepo root.
#
#   API_URL=https://clearsignal-api.<you>.workers.dev ./scripts/deploy.sh          → prod
#   API_URL=https://api.clearsignal.app                ./scripts/deploy.sh          → prod on custom domain
#   API_URL=https://clearsignal-api-staging.<you>.workers.dev ./scripts/deploy.sh staging
set -euo pipefail
cd "$(dirname "$0")/.."
ENV="${1:-prod}"
: "${API_URL:?Set API_URL to the API address (run step 2 in DEPLOY.md to get it)}"

pnpm install --frozen-lockfile
pnpm -r test

if [[ ! -f apps/web/public/kodagu.pmtiles ]]; then
  echo "⚠ apps/web/public/kodagu.pmtiles missing: the map will show pins without a basemap. Run ./scripts/build-pmtiles.sh first."
fi

if [[ "$ENV" == "staging" ]]; then
  (cd apps/edge && npx wrangler deploy --env staging)
  VITE_API_BASE="$API_URL" pnpm --filter web build
  (cd apps/web && ../edge/node_modules/.bin/wrangler pages deploy dist --project-name clearsignal-staging --branch main --commit-dirty=true)
else
  (cd apps/edge && npx wrangler deploy)
  VITE_API_BASE="$API_URL" pnpm --filter web build
  (cd apps/web && ../edge/node_modules/.bin/wrangler pages deploy dist --project-name clearsignal-app --branch main --commit-dirty=true)
  if [[ -n "${FLY_DEPLOY:-}" ]]; then (cd workers/python && flyctl deploy --config fly.toml); fi
fi

echo
echo "API:  $API_URL/health"
echo "Web:  https://clearsignal-app.pages.dev (or your custom domain)"
