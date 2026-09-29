"""Adapters whose live integration is not built yet.

Each is declared so the scheduler and Sources view know about it, but it
reports "not configured" rather than inventing data. The Kodagu 2018 replay
supplies these signal classes for the demo. Integration notes per adapter
live in docs/ARCHITECTURE.md.
"""
from __future__ import annotations

from datetime import datetime

from ._base import FetchResult


class _NotBuilt:
    source_id = ""
    tier = ""
    refresh_interval_seconds = 3600
    reason = ""
    configured = False

    async def fetch(self, since: datetime) -> FetchResult:
        return FetchResult(self.source_id, ok=False, error="not built: " + self.reason)


class Sentinel2(_NotBuilt):
    source_id, tier, refresh_interval_seconds = "sentinel-2-cdse", "T2", 43200
    reason = "NDWI water mask from CDSE STAC; copy the sentinel1 pattern (spec §7.2 P3)"


class CemsGfm(_NotBuilt):
    source_id, tier, refresh_interval_seconds = "cems-gfm", "T2", 86400
    reason = "needs openEO platform account (COPERNICUS_CLIENT_ID/SECRET)"


class Imd(_NotBuilt):
    source_id, tier, refresh_interval_seconds = "imd", "T3", 900
    reason = "needs IMD API registration (IMD_API_KEY) and endpoint confirmation"


class CwcWris(_NotBuilt):
    source_id, tier, refresh_interval_seconds = "cwc-wris", "T1", 3600
    reason = "india-water-data client integration pending; Kaveri station list to confirm"


class Nwdp(_NotBuilt):
    source_id, tier, refresh_interval_seconds = "nwdp", "T1", 3600
    reason = "NWDP telemetry endpoint to confirm"


class DiscomOutage(_NotBuilt):
    source_id, tier, refresh_interval_seconds = "discom-outage", "T4", 3600
    reason = "mock adapter: no machine-readable CESC/BESCOM feed; scrape path documented, not enabled"
