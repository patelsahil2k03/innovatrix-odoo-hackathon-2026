"""The "dynamic data" proof (docs/02 §4).

A background asyncio task that advances live trips a few percent every tick, auto-completes them
on arrival, and occasionally dispatches a fresh draft. Every mutation goes through the same
services the API uses — the simulator has no privileged path around the business rules, which is
the point: it's real traffic against a real rule engine, not a JSON file being replayed.

Disabled with SIMULATOR_ENABLED=false (tests always run with it off).
"""

import asyncio
import contextlib
import logging
import random
from datetime import UTC, datetime

from sqlalchemy import select

from transitops.core import events
from transitops.core.database import SessionLocal
from transitops.core.errors import AppError
from transitops.core.settings import get_settings
from transitops.models.enums import TripStatus
from transitops.models.trip import Trip
from transitops.services import dispatch

log = logging.getLogger("transitops.simulator")

PROGRESS_PER_TICK = (4.0, 12.0)  # percent
DISPATCH_CHANCE = 0.25  # per tick, when a draft is waiting


def _tick() -> None:
    """One simulation step. Runs in a threadpool — the ORM here is sync."""
    db = SessionLocal()
    try:
        live = db.scalars(select(Trip).where(Trip.status == TripStatus.DISPATCHED)).all()

        for trip in live:
            progress = float(trip.progress_percent) + random.uniform(*PROGRESS_PER_TICK)

            if progress < 100.0:
                trip.progress_percent = round(progress, 2)
                db.commit()
                events.hub.publish(
                    events.TRIP_PROGRESS,
                    trip_id=str(trip.id),
                    progress_percent=float(trip.progress_percent),
                )
                continue

            # Arrived: complete it through the real service, with plausible trip figures.
            planned = float(trip.planned_distance_km)
            actual = round(planned * random.uniform(0.97, 1.08), 2)
            vehicle_odometer = float(trip.vehicle.odometer_km)
            kmpl = random.uniform(5.5, 9.0)

            dispatch.complete_trip(
                db,
                trip,
                actual_distance_km=actual,
                final_odometer_km=round(vehicle_odometer + actual, 2),
                user_id=trip.created_by,
                fuel={
                    "liters": round(actual / kmpl, 2),
                    "cost": round((actual / kmpl) * random.uniform(89, 98), 2),
                },
            )

        # Keep the board alive: pull a waiting draft onto the road now and then.
        if random.random() < DISPATCH_CHANCE:
            draft = db.scalar(
                select(Trip).where(Trip.status == TripStatus.DRAFT).order_by(Trip.created_at)
            )
            if draft is not None:
                with contextlib.suppress(AppError):
                    # Its vehicle or driver may have been taken since the draft was written —
                    # that's the rule engine doing its job, not an error worth logging.
                    dispatch.dispatch_trip(db, draft)
    finally:
        db.close()


async def run(stop: asyncio.Event) -> None:
    settings = get_settings()
    log.info("simulator started (every %.1fs)", settings.simulator_interval_seconds)

    while not stop.is_set():
        try:
            await asyncio.to_thread(_tick)
        except Exception:
            # A bad tick must never kill the loop — the demo depends on this staying alive.
            log.exception("simulator tick failed")

        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(
                stop.wait(), timeout=settings.simulator_interval_seconds
            )

    log.info("simulator stopped")
