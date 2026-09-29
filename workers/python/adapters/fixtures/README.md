# Adapter fixtures

| File | Origin |
|---|---|
| `usgs_2.5_day.json` | Real capture of the USGS 2.5+ day feed, 2026-09-30 (trimmed to 5 features) |
| `gdacs_events4app.json` | Real capture of GDACS EVENTS4APP, 2026-09-30 (trimmed to 6 features, HTML fields dropped) |
| `firms_viirs.csv` | Hand-built in the documented FIRMS area-CSV format (no MAP_KEY available at capture time) |
| `openweather_onecall.json` | Hand-built in the documented One Call 3.0 shape (no API key at capture time) |
| `overpass_roads.json` | Hand-built Overpass `out tags` response |

Replace the hand-built ones with real captures once keys are provisioned. Tests never hit the network.
