"""NASA FIRMS VIIRS thermal anomalies (T2)."""
from __future__ import annotations

import csv
import io
import os
from datetime import datetime, timezone
from typing import Any, Dict, List

from ._base import KODAGU_BBOX, FetchResult, log, make_event
from ._http import get_text

URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/VIIRS_SNPP_NRT/{bbox}/1"
CONF = {"l": 0.3, "n": 0.6, "h": 0.9}


class Firms:
    source_id = "firms-nasa"
    tier = "T2"
    refresh_interval_seconds = 10800

    def __init__(self, key: str = "") -> None:
        self.key = key or os.environ.get("FIRMS_MAP_KEY", "")

    @property
    def configured(self) -> bool:
        return bool(self.key)

    def parse(self, text: str, since: datetime) -> List[Dict[str, Any]]:
        out = []
        for row in csv.DictReader(io.StringIO(text)):
            t = datetime.strptime("%s %s" % (row["acq_date"], row["acq_time"].zfill(4)), "%Y-%m-%d %H%M").replace(
                tzinfo=timezone.utc  # FIRMS acquisition times are UTC
            )
            if t < since:
                continue
            lat, lon = float(row["latitude"]), float(row["longitude"])
            out.append(
                make_event(
                    source_id=self.source_id, tier=self.tier, event_type="thermal_anomaly",
                    native_id="%s-%s-%s-%s" % (row["acq_date"], row["acq_time"], row["latitude"], row["longitude"]),
                    lat=lat, lon=lon, observed_at=t,
                    raw_value={"frp": float(row.get("frp") or 0), "confidence": row.get("confidence"), "satellite": row.get("satellite")},
                    normalized_value=float(row.get("frp") or 0),
                    confidence_hint=CONF.get(row.get("confidence", ""), None),
                )
            )
        return out

    async def fetch(self, since: datetime) -> FetchResult:
        if not self.configured:
            return FetchResult(self.source_id, ok=False, error="FIRMS_MAP_KEY not set")
        try:
            bbox = ",".join(str(x) for x in KODAGU_BBOX)
            return FetchResult(self.source_id, self.parse(await get_text(URL.format(key=self.key, bbox=bbox)), since))
        except Exception as e:
            log.warning("firms failed: %s", e)
            return FetchResult(self.source_id, ok=False, error=str(e)[:300])
