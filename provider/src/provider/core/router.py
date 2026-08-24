from typing import Literal

from fastapi import APIRouter
from pydantic import Field
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from provider.core.db import DBSessionDep
from provider.core.redis import RedisDep
from provider.core.schemas import CamelCaseBaseModel

router = APIRouter()

# Imported here rather than in app.py so the app module stays about wiring the
# application, not about knowing which modules exist.
from provider.authz.consent.routes import router as consent_router  # noqa: E402
from provider.authz.discovery.routes import router as discovery_router  # noqa: E402
from provider.authz.login.routes import router as login_router  # noqa: E402
from provider.authz.oauth.routes import router as oauth_router  # noqa: E402

router.include_router(discovery_router)
router.include_router(oauth_router)
router.include_router(login_router)
router.include_router(consent_router)


class HealthResponse(CamelCaseBaseModel):
    status: Literal["ok", "degraded"] = Field(
        description="`ok` only when every dependency is reachable."
    )
    database: Literal["ok", "unreachable"] = Field(description="PostgreSQL connectivity.")
    redis: Literal["ok", "unreachable"] = Field(description="Redis connectivity.")


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health",
    description=(
        "Reports whether the provider can reach PostgreSQL and Redis.\n\n"
        "Always returns `200` so a monitoring system can distinguish *the service "
        "is down* from *the service is up and telling you a dependency is down*.\n\n"
        "**Required scope:** none — this endpoint is public."
    ),
    tags=["health"],
)
async def health(session: DBSessionDep, redis: RedisDep) -> HealthResponse:
    try:
        await session.execute(text("select 1"))
        database = "ok"
    except SQLAlchemyError:
        database = "unreachable"

    try:
        await redis.ping()
        cache = "ok"
    except RedisError:
        cache = "unreachable"

    status = "ok" if database == "ok" and cache == "ok" else "degraded"
    return HealthResponse(status=status, database=database, redis=cache)
