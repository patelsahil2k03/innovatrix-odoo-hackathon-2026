"""Indian city catalog — the single source of truth (docs/03 §6).

Trips are created with city *names* (contract §4) but the trips table stores coordinates, which
is what the deck.gl map animates along. This catalog is the bridge, and the seed builds its trip
corridors and vehicle regions from it too (see seed/cities.py, which is a thin adapter over this
module). Keep it that way: when the seed had its own copy, the two drifted — the seed wrote trips
through cities the API then rejected as UNKNOWN_CITY, and they disagreed on Delhi's coordinates.
"""

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class City:
    name: str
    lat: float
    lng: float
    region: str


CITIES: tuple[City, ...] = (
    City("Ahmedabad", 23.0225, 72.5714, "Gujarat"),
    City("Surat", 21.1702, 72.8311, "Gujarat"),
    City("Vadodara", 22.3072, 73.1812, "Gujarat"),
    City("Rajkot", 22.3039, 70.8022, "Gujarat"),
    City("Mumbai", 19.0760, 72.8777, "Maharashtra"),
    City("Pune", 18.5204, 73.8567, "Maharashtra"),
    City("Nagpur", 21.1458, 79.0882, "Maharashtra"),
    City("Delhi", 28.6139, 77.2090, "Delhi NCR"),
    City("Jaipur", 26.9124, 75.7873, "Rajasthan"),
    City("Bengaluru", 12.9716, 77.5946, "Karnataka"),
    City("Hyderabad", 17.3850, 78.4867, "Telangana"),
    City("Chennai", 13.0827, 80.2707, "Tamil Nadu"),
    City("Kolkata", 22.5726, 88.3639, "West Bengal"),
    City("Indore", 22.7196, 75.8577, "Madhya Pradesh"),
)

CITY_BY_NAME: dict[str, City] = {city.name.lower(): city for city in CITIES}
CITY_NAMES: list[str] = [city.name for city in CITIES]
REGIONS: list[str] = sorted({city.region for city in CITIES})


def find_city(name: str) -> City | None:
    return CITY_BY_NAME.get(name.strip().lower())


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km. Road distance is ~1.25x this — see `road_distance_km`."""
    radius_km = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * radius_km * math.asin(math.sqrt(a))


def road_distance_km(a: City, b: City) -> float:
    """Planned distance when the client doesn't supply one: straight line + a 25% road factor."""
    return round(haversine_km(a.lat, a.lng, b.lat, b.lng) * 1.25, 2)
