import uuid
from collections.abc import Callable
from contextlib import asynccontextmanager

import structlog
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from provider.core import redis as redis_module
from provider.core.config import settings
from provider.core.db import engine
from provider.core.errors import IdenError
from provider.core.logging import configure_logging, logger
from provider.core.router import router
from provider.core.schemas import ErrorResponse

configure_logging()

# Domain errors carry no HTTP knowledge, so the mapping lives here — the one
# place that knows both vocabularies.
ERROR_STATUS = {
    "not_found": 404,
    "conflict": 409,
    "immutable": 409,
    "validation_error": 422,
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Provider starting", env=settings.iden_env, issuer=settings.iden_issuer)
    yield
    await engine.dispose()
    await redis_module.client.aclose()


app = FastAPI(
    title="IDEN Core Server",
    version="0.0.1",
    description=(
        "Identity and access control provider. "
        "See `/.well-known/openid-configuration` for OIDC metadata."
    ),
    lifespan=lifespan,
)


@app.middleware("http")
async def add_request_id(request: Request, call_next: Callable) -> Response | None:
    request_id = str(uuid.uuid4())

    request.state.request_id = request_id

    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)

    response = await call_next(request)
    return response


@app.exception_handler(IdenError)
async def handle_iden_error(request: Request, exc: IdenError) -> JSONResponse:
    """Safety net for domain errors that reach the app un-translated.

    Routes are expected to map their own domain exceptions; this keeps an
    escaped one from becoming an opaque 500.
    """
    logger.warning("Unhandled domain error", code=exc.code, path=request.url.path)
    body = ErrorResponse(code=exc.code, message=exc.message, details=exc.details)
    return JSONResponse(
        status_code=ERROR_STATUS.get(exc.code, 500), content=body.model_dump(by_alias=True)
    )


app.include_router(router, prefix=settings.iden_api_prefix)


def main():
    uvicorn.run(
        "provider.core.app:app", host="0.0.0.0", port=8000, log_config=None, reload=True
    )
