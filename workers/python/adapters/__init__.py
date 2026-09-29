from ._stubs import CemsGfm, CwcWris, DiscomOutage, Imd, Nwdp, Sentinel2
from .firms import Firms
from .gdacs import Gdacs
from .openweather import OpenWeather
from .overpass import Overpass
from .sentinel1 import Sentinel1
from .usgs_quake import UsgsQuake


def all_adapters():
    """Build order from spec §7.2 (priority 1 first)."""
    return [
        Sentinel1(), OpenWeather(), CwcWris(), Gdacs(), UsgsQuake(),
        CemsGfm(), Imd(), Nwdp(), Overpass(), Firms(),
        DiscomOutage(), Sentinel2(),
    ]
