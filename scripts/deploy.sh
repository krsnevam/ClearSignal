#!/usr/bin/env bash
# One-command deploy (also the rollback path: check out the last good commit and re-run).
#   ./scripts/deploy.sh            → prod
#   ./scripts/deploy.sh staging    → staging
set -euo pipefail
cd "$(dirname "$0")/.."
ENV="${1:-prod}"

pnpm install --frozen-lockfile
pnpm -r test

if [[ "$ENV" == "staging" ]]; then
  VITE_API_BASE="${VITE_API_BASE:-https://clearsignal-api-staging.workers.dev}" pnpm --filter web build
  npx wrangler pages deploy apps/web/dist --project-name clearsignal-staging
  (cd apps/edge && npx wrangler deploy --env staging)
else
  VITE_API_BASE="${VITE_API_BASE:-https://api.clearsignal.app}" pnpm --filter web build
  npx wrangler pages deploy apps/web/dist --project-name clearsignal-app
  (cd apps/edge && npx wrangler deploy)
  (cd workers/python && flyctl deploy --config fly.toml)
fi
