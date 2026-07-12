"""In-process pub/sub feeding the SSE hub (docs/02 §4).

Services publish AFTER their transaction commits, so a subscriber that immediately re-fetches
always sees the committed state. Publishing is non-blocking and never raises into the caller:
a slow or dead subscriber gets dropped events rather than failing someone's dispatch.

Thread-safety matters here: our routers are sync `def`, so FastAPI runs them in a threadpool,
while subscriber queues live on the event loop. Waking an asyncio.Queue from a worker thread is
only safe via `call_soon_threadsafe`, which is what `publish()` does when off-loop.
"""

import asyncio
import contextlib
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

# Event names — the frontend keys its query invalidation off these.
TRIP_DISPATCHED = "trip.dispatched"
TRIP_COMPLETED = "trip.completed"
TRIP_CANCELLED = "trip.cancelled"
TRIP_PROGRESS = "trip.progress"
VEHICLE_STATUS_CHANGED = "vehicle.status_changed"
DRIVER_STATUS_CHANGED = "driver.status_changed"
MAINTENANCE_OPENED = "maintenance.opened"
MAINTENANCE_CLOSED = "maintenance.closed"
FUEL_LOGGED = "fuel.logged"
EXPENSE_LOGGED = "expense.logged"
ALERT_CREATED = "alert.created"
KPI_REFRESH = "kpi.refresh"

_QUEUE_MAXSIZE = 100


@dataclass
class Event:
    name: str
    data: dict[str, Any] = field(default_factory=dict)


class EventHub:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[Event]] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Called once from the app lifespan so off-loop publishers know where to hand off."""
        self._loop = loop

    def publish(self, name: str, **data: Any) -> None:
        """Fire-and-forget; callable from the event loop or from a threadpool worker."""
        event = Event(name=name, data=data)
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None

        if running is not None:
            self._fanout(event)
        elif self._loop is not None and not self._loop.is_closed():
            self._loop.call_soon_threadsafe(self._fanout, event)
        # No loop bound (e.g. unit tests calling a service directly) — nobody to notify.

    def _fanout(self, event: Event) -> None:
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                # Subscriber is not draining; drop rather than block the writer.
                pass

    @contextlib.asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[Event]]:
        queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=_QUEUE_MAXSIZE)
        self._subscribers.add(queue)
        try:
            yield queue
        finally:
            self._subscribers.discard(queue)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)


hub = EventHub()
