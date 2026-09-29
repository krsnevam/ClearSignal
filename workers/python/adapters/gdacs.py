"""GDACS multi-hazard alerts (T3)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from ._base import FetchResult, in_kodagu, log, make_event
from ._http import get_json

FEED = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP"
LEVEL = {"Green": 1.0, "Orange": 2.0, "Red": 3.0}


def _parse_time(s: str) -> datetime:
    # GDACS gives naive ISO timestamps in UTC.
    dt = datetime.fromisoformat(s.replace("Z", ""))
    return dt.replace(tzinfo=timezone.utc)


class Gdacs:
    source_id = "gdacs"
    tier = "T3"
    refresh_interval_seconds = 300

    def parse(self, payload: Dict[str, Any], since: datetime) -> List[Dict[str, Any]]:
        out = []
        for f in payload.get("features", []):
            if f.get("geometry", {}).get("type") != "Point":
                continue
            lon, lat = f["geometry"]["coordinates"][:2]
            if not in_kodagu(lat, lon, pad=2.0):
                continue
            p = f["properties"]
            t = _parse_time(p.get("datemodified") or p["fromdate"])
            if t < since:
                continue
            out.append(
                make_event(
                    source_id=self.source_id, tier=self.tier, event_type="multi_hazard_alert",
                    native_id="%s-%s-%s" % (p.get("eventtype"), p.get("eventid"), p.get("episodeid")),
                    lat=lat, lon=lon, observed_at=t,
                    raw_value={k: p.get(k) for k in ("eventtype", "name", "alertlevel", "country", "description")},
                    normalized_value=LEVEL.get(p.get("alertlevel", ""), None),
                )
            )
        return out

    async def fetch(self, since: datetime) -> FetchResult:
        try:
            return FetchResult(self.source_id, self.parse(await get_json(FEED, use_etag=True), since))
        except Exception as e:
            log.warning("gdacs failed: %s", e)
            return FetchResult(self.source_id, ok=False, error=str(e)[:300])
