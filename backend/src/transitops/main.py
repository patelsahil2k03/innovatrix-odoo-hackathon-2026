import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from transitops.core.audit import AuditMiddleware
from transitops.core.errors import register_error_handlers
from transitops.core.events import hub
from transitops.core.settings import get_settings
from transitops.routers.analytics import router as analytics_router
from transitops.routers.auth import router as auth_router
from transitops.routers.costs import expense_router, fuel_router
from transitops.routers.drivers import router as drivers_router
from transitops.routers.events import router as events_router
from transitops.routers.health import router as health_router
from transitops.routers.maintenance import router as maintenance_router
from transitops.routers.support import router as support_router
from transitops.routers.trips import router as trips_router
from transitops.routers.vehicles import router as vehicles_router
from transitops.services import simulator

logging.basicConfig(level=logging.INFO)

DESCRIPTION = """
TransitOps — fleet operations API.

**Auth**: `POST /api/v1/auth/login` sets an httpOnly cookie. For Swagger/curl, `POST
/api/v1/auth/token` returns a bearer token instead.

Demo accounts (all share one password, printed by the seed script):
`fleet@` · `dispatch@` · `safety@` · `finance@` `transitops.in`

Every business rule (00_MASTER_PLAN §5) is enforced server-side inside a locked transaction —
see `services/dispatch.py`. Errors always come back as
`{"error": {"code", "message", "fields"}}`.
"""


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()

    # Sync service code runs in a threadpool; the SSE queues live on this loop. Give the hub a
    # handle so off-loop publishes are marshalled back safely.
    hub.bind_loop(asyncio.get_running_loop())

    stop = asyncio.Event()
    task: asyncio.Task | None = None
    if settings.simulator_enabled:
        task = asyncio.create_task(simulator.run(stop))

    try:
        yield
    finally:
        stop.set()
        if task is not None:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        description=DESCRIPTION,
        version="1.0.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,  # the auth cookie is cross-origin (web :3000 → api :8000)
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(AuditMiddleware, api_prefix=settings.api_prefix)

    register_error_handlers(app)

    for router in (
        health_router,
        auth_router,
        vehicles_router,
        drivers_router,
        trips_router,
        maintenance_router,
        fuel_router,
        expense_router,
        analytics_router,
        support_router,
        events_router,
    ):
        app.include_router(router, prefix=settings.api_prefix)

    return app


app = create_app()
