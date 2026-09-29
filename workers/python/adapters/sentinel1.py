"""Sentinel-1 SAR flood extent via dask-flood-mapper (T2).

TU Wien's Bayesian near-real-time algorithm (Bauer-Marschallinger et al. 2022),
packaged by interTwin. Returns a flood/no-flood raster over the bbox; we
aggregate it to the 500 m grid and emit a flood_extent event per cell whose
flooded fraction exceeds FLOOD_FRACTION. Raw pulls are cached under
/data/s1/*.zarr so replays cost nothing.

Needs the optional `sar` extra (pip install .[sar]); without it the adapter
reports "not configured" and the replay provides SAR events instead.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from ._base import KODAGU_BBOX, FetchResult, log, make_event

CACHE_DIR = os.environ.get("S1_CACHE_DIR", "/data/s1")
FLOOD_FRACTION = 0.3
CELL = 0.005  # degrees, matches the normalizer grid


def cells_from_fractions(fractions: Dict[tuple, float], observed_at: datetime, source_id: str, tier: str) -> List[Dict[str, Any]]:
    """fractions: {(lat_snapped, lon_snapped): flooded_fraction} → events."""
    out = []
    for (lat, lon), frac in sorted(fractions.items()):
        if frac < FLOOD_FRACTION:
            continue
        clat, clon = lat + CELL / 2, lon + CELL / 2
        out.append(
            make_event(
                source_id=source_id, tier=tier, event_type="flood_extent",
                native_id="%s-%.4f-%.4f" % (observed_at.strftime("%Y%m%dT%H%M"), lat, lon),
                lat=clat, lon=clon, observed_at=observed_at,
                raw_value={"flooded_fraction": round(frac, 3), "algorithm": "dask-flood-mapper (TU Wien Bayesian)"},
                normalized_value=round(frac, 3),
            )
        )
    return out


class Sentinel1:
    source_id = "sentinel-1-cdse"
    tier = "T2"
    refresh_interval_seconds = 21600

    @property
    def configured(self) -> bool:
        try:
            import dask_flood_mapper  # noqa: F401
        except ImportError:
            return False
        return True

    async def fetch(self, since: datetime) -> FetchResult:
        if not self.configured:
            return FetchResult(self.source_id, ok=False, error="dask-flood-mapper not installed (pip install .[sar])")
        try:
            import numpy as np
            from dask_flood_mapper import flood

            end = datetime.now(timezone.utc)
            start = min(since, end - timedelta(days=3))
            fd = flood.decision(bbox=list(KODAGU_BBOX), datetime="%s/%s" % (start.date(), end.date()))
            os.makedirs(CACHE_DIR, exist_ok=True)
            fd.to_dataset(name="flood").to_zarr(
                os.path.join(CACHE_DIR, "%s.zarr" % end.strftime("%Y%m%dT%H")), mode="w"
            )
            events: List[Dict[str, Any]] = []
            for t in fd.time.values:
                layer = fd.sel(time=t)
                observed = datetime.utcfromtimestamp(int(np.datetime64(t, "s").astype(int))).replace(tzinfo=timezone.utc)
                if observed < since:
                    continue
                lat_snap = (np.floor(layer.y * 200) / 200).rename("lat")
                lon_snap = (np.floor(layer.x * 200) / 200).rename("lon")
                grouped = layer.groupby(lat_snap).mean().groupby(lon_snap).mean()
                fr = {
                    (float(la), float(lo)): float(grouped.sel(lat=la, lon=lo))
                    for la in grouped.lat.values
                    for lo in grouped.lon.values
                    if not np.isnan(grouped.sel(lat=la, lon=lo))
                }
                events += cells_from_fractions(fr, observed, self.source_id, self.tier)
            return FetchResult(self.source_id, events)
        except Exception as e:
            log.warning("sentinel-1 failed: %s", e)
            return FetchResult(self.source_id, ok=False, error=str(e)[:300])
