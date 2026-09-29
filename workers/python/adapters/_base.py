"""Common adapter shape (spec §7.1) and helpers shared by every adapter.

Every adapter is:
  * idempotent       — event ids are derived from the source's own ids, so
                       replaying a window yields identical events;
  * fault-tolerant   — network failures return [] and log; they never raise;
  * time-respectful  — timestamps are converted to UTC inside the adapter.

The edge API re-validates everything and re-assigns the tier from its own
registry, so a misbehaving adapter cannot promote itself.
"""
from __future__ import annotations

import logging
import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:  # Python 3.8 compatible Protocol
    from typing import Protocol
except ImportError:  # pragma: no cover
    from typing_extensions import Protocol  # type: ignore

log = logging.getLogger("clearsignal.adapters")

# Kodagu district bounding box (W, S, E, N) — mirrors packages/kodagu-fixtures.
KODAGU_BBOX = (75.4, 11.9, 76.2, 12.9)

# Stable namespace so the same source record always maps to the same UUID.
NAMESPACE = uuid.UUID("6f1c3c56-8a5e-4b0e-9d1f-5a7c2b3e4d10")

# Taluka / town points polled by point-based feeds (weather).
POLL_POINTS = [
    ("Madikeri", 12.4244, 75.7382),
    ("Bhagamandala", 12.3858, 75.5333),
    ("Makkandur", 12.4632, 75.7628),
    ("Napoklu", 12.3067, 75.7222),
    ("Somwarpet", 12.5977, 75.8511),
    ("Kushalnagar", 12.4575, 75.9594),
    ("Virajpet", 12.1966, 75.8053),
    ("Siddapur", 12.3033, 75.8664),
    ("Ponnampet", 12.1462, 75.9429),
    ("Shanivarsanthe", 12.7296, 75.8706),
    ("Sampaje", 12.5003, 75.5712),
    ("Talakaveri", 12.3861, 75.4948),
]


class Adapter(Protocol):
    source_id: str
    tier: str  # informational; the edge registry is authoritative
    refresh_interval_seconds: int

    async def fetch(self, since: datetime) -> List[Dict[str, Any]]:
        """Return all events with source-timestamp >= since. Never raises."""
        ...


def in_kodagu(lat: float, lon: float, pad: float = 0.0) -> bool:
    w, s, e, n = KODAGU_BBOX
    return (s - pad) <= lat <= (n + pad) and (w - pad) <= lon <= (e + pad)


def grid_cell_id(lat: float, lon: float) -> str:
    """0.005° ≈ 500 m grid — identical to packages/fusion normalize.ts."""
    return "%.4f_%.4f_500m" % (math.floor(lat * 200) / 200, math.floor(lon * 200) / 200)


def to_utc_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        raise ValueError("naive datetime — adapters must attach the source's zone before converting")
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (dt.microsecond // 1000)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def event_id(source_id: str, native_id: str) -> str:
    return str(uuid.uuid5(NAMESPACE, "%s:%s" % (source_id, native_id)))


def make_event(
    *,
    source_id: str,
    tier: str,
    event_type: str,
    native_id: str,
    lat: float,
    lon: float,
    observed_at: datetime,
    raw_value: Dict[str, Any],
    normalized_value: Optional[float] = None,
    confidence_hint: Optional[float] = None,
    polarity: int = 1,
    place_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a RawEvent dict (packages/schema/src/event.ts)."""
    return {
        "id": event_id(source_id, native_id),
        "source_id": source_id,
        "source_tier": tier,
        "event_type": event_type,
        "location": {
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "grid_cell_id": grid_cell_id(lat, lon),
            "place_name": place_name,
            "taluka": None,
            "district": "kodagu",
        },
        "observed_at_utc": to_utc_iso(observed_at),
        "received_at_utc": to_utc_iso(utc_now()),
        "raw_value": raw_value,
        "normalized_value": normalized_value,
        "confidence_hint": confidence_hint,
        "polarity": polarity,
    }


@dataclass
class FetchResult:
    source_id: str
    events: List[Dict[str, Any]] = field(default_factory=list)
    ok: bool = True
    error: Optional[str] = None
