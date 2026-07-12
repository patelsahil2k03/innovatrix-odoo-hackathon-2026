"""Indian city catalog (docs/03 §6).

Trips are created with city *names* (contract §4) but the trips table stores coordinates, which
is what the deck.gl map animates along. This catalog is the bridge, and is also what the seed
draws from — so every trip in the system has real coordinates without a routing engine.
"""

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class City:
    name: str
    lat: float
    lng: float


CITIES: tuple[City, ...] = (
    City("Ahmedabad", 23.0225, 72.5714),
    City("Mumbai", 19.0760, 72.8777),
    City("Delhi", 28.6139, 77.2090),
    City("Bengaluru", 12.9716, 77.5946),
    City("Pune", 18.5204, 73.8567),
    City("Surat", 21.1702, 72.8311),
    City("Jaipur", 26.9124, 75.7873),
    City("Hyderabad", 17.3850, 78.4867),
    City("Chennai", 13.0827, 80.2707),
    City("Kolkata", 22.5726, 88.3639),
    City("Indore", 22.7196, 75.8577),
    City("Nagpur", 21.1458, 79.0882),
)

CITY_BY_NAME: dict[str, City] = {city.name.lower(): city for city in CITIES}
CITY_NAMES: list[str] = [city.name for city in CITIES]


def find_city(name: str) -> City | None:
    return CITY_BY_NAME.get(name.strip().lower())


def haversine_km(a: City, b: City) -> float:
    """Great-circle distance. Road distance is ~1.25x this — see `road_distance_km`."""
    radius_km = 6371.0
    lat1, lng1, lat2, lng2 = map(math.radians, (a.lat, a.lng, b.lat, b.lng))
    dlat, dlng = lat2 - lat1, lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * radius_km * math.asin(math.sqrt(h))


def road_distance_km(a: City, b: City) -> float:
    """Planned distance when the client doesn't supply one: straight line + a 25% road factor."""
    return round(haversine_km(a, b) * 1.25, 2)
