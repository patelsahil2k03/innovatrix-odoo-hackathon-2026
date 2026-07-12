"""SSE hub — `GET /events` (docs/02 §4).

The frontend opens one EventSource and invalidates the matching queries as events arrive, which
is what makes the dashboard and map move without a refresh.
"""

import asyncio
import json

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from transitops.core import events as event_bus
from transitops.core.rbac import get_current_user
from transitops.models.user import User

router = APIRouter(tags=["real-time"])

HEARTBEAT_SECONDS = 15


@router.get("/events")
async def stream(_: User = Depends(get_current_user)):
    async def publisher():
        async with event_bus.hub.subscribe() as queue:
            # Tell the client it's connected before the first domain event (which may be minutes
            # away) so it doesn't sit there wondering.
            yield {"event": "connected", "data": json.dumps({"ok": True})}

            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
                except TimeoutError:
                    # Comment frame: keeps proxies and the browser from closing an idle stream.
                    yield {"comment": "heartbeat"}
                    continue

                yield {"event": event.name, "data": json.dumps(event.data)}

    return EventSourceResponse(
        publisher(),
        headers={
            # Nginx buffers responses by default, which would batch our events into useless
            # clumps; this opts the stream out.
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
        },
    )
