"""Seed-facing view of the city catalog.

The catalog itself lives in `transitops.core.cities` — the API validates trip cities against it,
so the seed MUST draw from the same list or it writes trips through cities the API then rejects
with UNKNOWN_CITY. This module only reshapes it into the dicts seed.py consumes; it deliberately
holds no city data of its own.
"""

from transitops.core.cities import CITIES as _CITIES
from transitops.core.cities import REGIONS, haversine_km

CITIES = [
    {"name": city.name, "lat": city.lat, "lng": city.lng, "region": city.region}
    for city in _CITIES
]

__all__ = ["CITIES", "REGIONS", "haversine_km"]
