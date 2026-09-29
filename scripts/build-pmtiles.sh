#!/usr/bin/env bash
# Extracts a Kodagu clip (z0–15) from the Protomaps daily planet build (~14 MB).
set -euo pipefail
cd "$(dirname "$0")/.."
BBOX="75.4,11.9,76.2,12.9"   # W,S,E,N — same as KODAGU_BBOX
DATE="${PMTILES_BUILD_DATE:-$(date -u -d 'yesterday' +%Y%m%d 2>/dev/null || date -u -v-1d +%Y%m%d)}"
SRC="https://build.protomaps.com/${DATE}.pmtiles"
OUT="apps/web/public/kodagu.pmtiles"
echo "Extracting $BBOX from $SRC …"
pmtiles extract "$SRC" "$OUT" --bbox="$BBOX" --maxzoom=15
ls -lh "$OUT"
