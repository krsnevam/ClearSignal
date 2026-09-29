"""OSM road status via Overpass (T3).

For each poll point, counts drivable roads within 5 km and those OSM marks as
impassable (access=no, highway=construction, or a flood/landslide closure note),
giving a reachability score. OSM rarely carries real-time closures, so in live
use this is a weak signal; in the replay, road closures come from the 2018
landslide archive instead.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from ._base import POLL_POINTS, FetchResult, log, make_event, utc_now
from ._http import post_data

URL = "https://overpass-api.de/api/interpreter"
QUERY = """
[out:json][timeout:25];
(
  way(around:5000,{lat},{lon})["highway"~"^(trunk|primary|secondary|tertiary|unclassified|residential)$"];
);
out tags;
"""


def is_blocked(tags: Dict[str, str]) -> bool:
    if tags.get("access") == "no" or tags.get("highway") == "construction":
        return True
    note = (tags.get("note", "") + " " + tags.get("description", "")).lower()
    return any(k in note for k in ("landslide", "washed out", "flooded", "closed"))


class Overpass:
    source_id = "overpass"
    tier = "T3"
    refresh_interval_seconds = 21600

    def parse(self, place: str, lat: float, lon: float, payload: Dict[str, Any], now: datetime) -> List[Dict[str, Any]]:
        ways = [e for e in payload.get("elements", []) if e.get("type") == "way"]
        if not ways:
            return []
        blocked = [w for w in ways if is_blocked(w.get("tags", {}))]
        if not blocked:
            return []
        reach = round(1 - len(blocked) / len(ways), 3)
        return [
            make_event(
                source_id=self.source_id, tier=self.tier, event_type="road_impassable",
                native_id="%s-%s" % (place, ",".join(sorted(str(w["id"]) for w in blocked))),
                lat=lat, lon=lon, observed_at=now, place_name=place,
                raw_value={
                    "reachability_score": reach,
                    "blocked_way_ids": [w["id"] for w in blocked][:20],
                    "roads_within_5km": len(ways),
                    "road": (blocked[0].get("tags", {}).get("name") or "road"),
                },
                normalized_value=1 - reach,
            )
        ]

    async def fetch(self, since: datetime) -> FetchResult:
        events: List[Dict[str, Any]] = []
        now = utc_now()
        for place, lat, lon in POLL_POINTS:
            try:
                payload = await post_data(URL, {"data": QUERY.format(lat=lat, lon=lon)})
                events += self.parse(place, lat, lon, payload, now)
            except Exception as e:
                log.warning("overpass %s failed: %s", place, e)
        return FetchResult(self.source_id, events)
