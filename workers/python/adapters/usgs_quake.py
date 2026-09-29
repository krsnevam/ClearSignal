"""USGS earthquake GeoJSON feed (T1). Rare in Kodagu; kept for the multi-hazard story."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from ._base import FetchResult, in_kodagu, log, make_event
from ._http import get_json

FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"


class UsgsQuake:
    source_id = "usgs-quake"
    tier = "T1"
    refresh_interval_seconds = 300

    def parse(self, payload: Dict[str, Any], since: datetime) -> List[Dict[str, Any]]:
        out = []
        for f in payload.get("features", []):
            lon, lat = f["geometry"]["coordinates"][:2]
            p = f["properties"]
            if not in_kodagu(lat, lon, pad=1.0):  # felt-range margin around the district
                continue
            t = datetime.fromtimestamp(p["time"] / 1000, tz=timezone.utc)
            if t < since:
                continue
            out.append(
                make_event(
                    source_id=self.source_id, tier=self.tier, event_type="earthquake",
                    native_id=f["id"], lat=lat, lon=lon, observed_at=t,
                    raw_value={"mag": p.get("mag"), "place": p.get("place"), "url": p.get("url")},
                    normalized_value=p.get("mag"),
                )
            )
        return out

    async def fetch(self, since: datetime) -> FetchResult:
        try:
            return FetchResult(self.source_id, self.parse(await get_json(FEED, use_etag=True), since))
        except Exception as e:  # never raise
            log.warning("usgs-quake failed: %s", e)
            return FetchResult(self.source_id, ok=False, error=str(e)[:300])
