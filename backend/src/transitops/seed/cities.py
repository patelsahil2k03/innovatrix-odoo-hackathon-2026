"""Reference data: 12 Indian cities used across the seed as trip corridors and vehicle regions."""

from math import asin, cos, radians, sin, sqrt

CITIES = [
    {"name": "Ahmedabad", "lat": 23.0225, "lng": 72.5714, "region": "Gujarat"},
    {"name": "Surat", "lat": 21.1702, "lng": 72.8311, "region": "Gujarat"},
    {"name": "Vadodara", "lat": 22.3072, "lng": 73.1812, "region": "Gujarat"},
    {"name": "Rajkot", "lat": 22.3039, "lng": 70.8022, "region": "Gujarat"},
    {"name": "Mumbai", "lat": 19.0760, "lng": 72.8777, "region": "Maharashtra"},
    {"name": "Pune", "lat": 18.5204, "lng": 73.8567, "region": "Maharashtra"},
    {"name": "Nagpur", "lat": 21.1458, "lng": 79.0882, "region": "Maharashtra"},
    {"name": "Delhi", "lat": 28.7041, "lng": 77.1025, "region": "Delhi NCR"},
    {"name": "Jaipur", "lat": 26.9124, "lng": 75.7873, "region": "Rajasthan"},
    {"name": "Bengaluru", "lat": 12.9716, "lng": 77.5946, "region": "Karnataka"},
    {"name": "Hyderabad", "lat": 17.3850, "lng": 78.4867, "region": "Telangana"},
    {"name": "Indore", "lat": 22.7196, "lng": 75.8577, "region": "Madhya Pradesh"},
]

REGIONS = sorted({city["region"] for city in CITIES})


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two lat/lng points, in km."""
    earth_radius_km = 6371.0
    p1, p2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(p1) * cos(p2) * sin(dlambda / 2) ** 2
    return 2 * earth_radius_km * asin(sqrt(a))
