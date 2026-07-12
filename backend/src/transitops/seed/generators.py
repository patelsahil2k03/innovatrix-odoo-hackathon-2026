"""rng-driven builders for seed entities.

Every random choice must go through the `rng` (random.Random(1729), see seed.py) passed into
these functions — never the global `random` module — so two runs against a fresh DB produce
byte-identical data.
"""

FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna",
    "Ishaan", "Rohan", "Kabir", "Dev",
    "Ananya", "Diya", "Priya", "Isha", "Neha", "Kavya", "Riya", "Meera",
]

LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Gupta", "Mehta", "Iyer", "Nair", "Reddy",
    "Choudhary", "Joshi", "Desai", "Kulkarni", "Singh", "Rao", "Bhatt",
]

STATE_CODES = {
    "Gujarat": "GJ",
    "Maharashtra": "MH",
    "Delhi NCR": "DL",
    "Rajasthan": "RJ",
    "Karnataka": "KA",
    "Telangana": "TS",
    "Madhya Pradesh": "MP",
}

VEHICLE_MODELS = {
    "truck": ["Tata 1512 LPT", "Ashok Leyland Ecomet 1615", "Mahindra Blazo X 28", "Eicher Pro 3015"],
    "van": ["Tata Ace Gold", "Mahindra Bolero Pik-up", "Force Trax Cruiser"],
    "mini": ["Tata Ace HT", "Mahindra Jeeto", "Piaggio Ape Xtra"],
    "bus": ["Tata Starbus Ultra", "Ashok Leyland Viking", "Force Traveller 3700"],
}

# (min, max) by vehicle_type — kg for capacity, km for odometer, INR for acquisition cost
CAPACITY_KG_RANGE = {
    "truck": (5000, 16000),
    "van": (1000, 2200),
    "mini": (750, 1500),
    "bus": (500, 1200),
}
ODOMETER_KM_RANGE = {
    "truck": (50000, 250000),
    "van": (20000, 140000),
    "mini": (15000, 110000),
    "bus": (80000, 300000),
}
ACQUISITION_COST_RANGE = {
    "truck": (1800000, 4500000),
    "van": (700000, 1300000),
    "mini": (400000, 700000),
    "bus": (2500000, 6000000),
}


def make_name(rng) -> str:
    return f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"


def make_phone(rng) -> str:
    return f"+91{rng.randint(70000, 99999)}{rng.randint(10000, 99999)}"


def make_plate(rng, region: str, used: set[str]) -> str:
    state = STATE_CODES.get(region, "GJ")
    while True:
        district = rng.randint(1, 40)
        series = "".join(rng.choice("ABCDEFGHJKLMNPQRSTUVWXYZ") for _ in range(2))
        number = rng.randint(1, 9999)
        plate = f"{state}{district:02d}{series}{number:04d}"
        if plate not in used:
            used.add(plate)
            return plate


def make_license_number(rng, region: str, used: set[str]) -> str:
    state = STATE_CODES.get(region, "GJ")
    while True:
        year = rng.randint(2008, 2023)
        seq = rng.randint(1, 9999999)
        license_number = f"{state}{rng.randint(1, 14):02d}{year}{seq:07d}"
        if license_number not in used:
            used.add(license_number)
            return license_number
