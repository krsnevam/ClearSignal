"""OpenWeather One Call 3.0 (T3). Rainfall > 25 mm/h emits heavy_rain (spec §7.2)."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List

from ._base import POLL_POINTS, FetchResult, log, make_event
from ._http import get_json

URL = "https://api.openweathermap.org/data/3.0/onecall"
HEAVY_MM_H = 25.0


class OpenWeather:
    source_id = "openweather"
    tier = "T3"
    refresh_interval_seconds = 600

    def __init__(self, key: str = "") -> None:
        self.key = key or os.environ.get("OPENWEATHER_API_KEY", "")

    @property
    def configured(self) -> bool:
        return bool(self.key)

    def parse(self, place: str, lat: float, lon: float, payload: Dict[str, Any], since: datetime) -> List[Dict[str, Any]]:
        out = []
        cur = payload.get("current", {})
        rain = float((cur.get("rain") or {}).get("1h", 0.0))
        t = datetime.fromtimestamp(cur.get("dt", 0), tz=timezone.utc)
        if rain > HEAVY_MM_H and t >= since:
            out.append(
                make_event(
                    source_id=self.source_id, tier=self.tier, event_type="heavy_rain",
                    native_id="%s-%d" % (place, cur["dt"]), lat=lat, lon=lon, observed_at=t, place_name=place,
                    raw_value={"rain_1h_mm": rain, "endpoint": "onecall/3.0 current"}, normalized_value=rain,
                )
            )
        for a in payload.get("alerts", []) or []:
            if "rain" not in (a.get("event", "") + " " + a.get("description", "")).lower():
                continue
            at = datetime.fromtimestamp(a["start"], tz=timezone.utc)
            if at < since:
                continue
            out.append(
                make_event(
                    source_id=self.source_id, tier=self.tier, event_type="heavy_rain",
                    native_id="%s-alert-%d-%s" % (place, a["start"], a.get("event")), lat=lat, lon=lon,
                    observed_at=at, place_name=place,
                    raw_value={"kind": "alert", "text": a.get("event"), "sender": a.get("sender_name")},
                )
            )
        return out

    async def fetch(self, since: datetime) -> FetchResult:
        if not self.configured:
            return FetchResult(self.source_id, ok=False, error="OPENWEATHER_API_KEY not set")
        events: List[Dict[str, Any]] = []
        errors = 0
        for place, lat, lon in POLL_POINTS:
            try:
                payload = await get_json(
                    URL, {"lat": lat, "lon": lon, "exclude": "daily,hourly", "units": "metric", "appid": self.key}
                )
                events += self.parse(place, lat, lon, payload, since)
            except Exception as e:
                errors += 1
                log.warning("openweather %s failed: %s", place, e)
        if errors == len(POLL_POINTS):
            return FetchResult(self.source_id, ok=False, error="all %d points failed" % errors)
        return FetchResult(self.source_id, events)
