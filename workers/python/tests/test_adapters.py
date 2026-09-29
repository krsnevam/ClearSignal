import csv
import json
import pathlib
import re
import sys
from datetime import datetime, timezone

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from adapters._base import grid_cell_id, make_event, to_utc_iso  # noqa: E402
from adapters.firms import Firms  # noqa: E402
from adapters.gdacs import Gdacs  # noqa: E402
from adapters.openweather import OpenWeather  # noqa: E402
from adapters.overpass import Overpass, is_blocked  # noqa: E402
from adapters.sentinel1 import cells_from_fractions  # noqa: E402
from adapters.usgs_quake import UsgsQuake  # noqa: E402

FIX = pathlib.Path(__file__).resolve().parents[1] / "adapters" / "fixtures"
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


def assert_raw_event(e):
    assert UUID.match(e["id"])
    assert e["source_tier"] in ("T1", "T2", "T3", "T4")
    assert ISO.match(e["observed_at_utc"]) and ISO.match(e["received_at_utc"])
    assert e["location"]["district"] == "kodagu"
    assert e["location"]["grid_cell_id"] == grid_cell_id(e["location"]["lat"], e["location"]["lon"])


def test_grid_matches_typescript_normalizer():
    # Same value as packages/fusion engine.test.ts
    assert grid_cell_id(12.4123, 75.7245) == "12.4100_75.7200_500m"


def test_timestamps_must_carry_a_zone():
    import pytest

    with pytest.raises(ValueError):
        to_utc_iso(datetime(2018, 8, 16, 9, 0))
    ist = datetime.fromisoformat("2018-08-16T09:00:00+05:30")
    assert to_utc_iso(ist) == "2018-08-16T03:30:00.000Z"


def test_ids_are_idempotent():
    kw = dict(source_id="gdacs", tier="T3", event_type="multi_hazard_alert", native_id="FL-1-2", lat=12.4, lon=75.7,
              observed_at=datetime(2018, 8, 16, tzinfo=timezone.utc), raw_value={})
    assert make_event(**kw)["id"] == make_event(**kw)["id"]


def test_usgs_real_capture_filters_to_kodagu():
    payload = json.loads((FIX / "usgs_2.5_day.json").read_text())
    assert isinstance(UsgsQuake().parse(payload, EPOCH), list)
    # Inject one quake near Kodagu into the real payload shape
    f = dict(payload["features"][0])
    f["geometry"] = {"type": "Point", "coordinates": [75.9, 12.5, 10]}
    f["id"] = "kodagu-test"
    events = UsgsQuake().parse({"features": [f] + payload["features"]}, EPOCH)
    assert [e["raw_value"]["mag"] for e in events] == [f["properties"]["mag"]]
    assert_raw_event(events[0])


def test_gdacs_real_capture_parses():
    payload = json.loads((FIX / "gdacs_events4app.json").read_text())
    f = json.loads(json.dumps(payload["features"][0]))
    f["geometry"]["coordinates"] = [75.7, 12.4]
    events = Gdacs().parse({"features": [f] + payload["features"]}, EPOCH)
    assert len(events) >= 1
    assert events[0]["event_type"] == "multi_hazard_alert"
    assert_raw_event(events[0])


def test_firms_csv_is_utc():
    events = Firms(key="x").parse((FIX / "firms_viirs.csv").read_text(), EPOCH)
    assert len(events) == 2
    assert events[0]["observed_at_utc"] == "2026-03-14T08:42:00.000Z"
    assert events[1]["confidence_hint"] == 0.9
    for e in events:
        assert_raw_event(e)


def test_openweather_heavy_rain_threshold_and_rain_alerts_only():
    payload = json.loads((FIX / "openweather_onecall.json").read_text())
    events = OpenWeather(key="x").parse("Bhagamandala", 12.3858, 75.5333, payload, EPOCH)
    assert [e["raw_value"].get("rain_1h_mm") for e in events] == [38.2, None]
    assert events[1]["raw_value"]["text"] == "Extremely heavy rain"
    payload["current"]["rain"]["1h"] = 12.0
    assert len(OpenWeather(key="x").parse("B", 12.38, 75.53, payload, EPOCH)) == 1


def test_overpass_reachability():
    payload = json.loads((FIX / "overpass_roads.json").read_text())
    [e] = Overpass().parse("Bhagamandala", 12.3858, 75.5333, payload, datetime(2018, 8, 16, tzinfo=timezone.utc))
    assert e["raw_value"]["reachability_score"] == 0.5
    assert sorted(e["raw_value"]["blocked_way_ids"]) == [102, 104]
    assert not is_blocked({"highway": "primary"})


def test_sentinel1_cells_threshold():
    t = datetime(2018, 8, 16, 3, 8, tzinfo=timezone.utc)
    events = cells_from_fractions({(12.46, 75.76): 0.8, (12.47, 75.76): 0.1}, t, "sentinel-1-cdse", "T2")
    assert len(events) == 1
    assert events[0]["location"]["grid_cell_id"] == "12.4600_75.7600_500m"
