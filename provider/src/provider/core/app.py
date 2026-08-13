import uuid
from collections.abc import Callable
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, Response

from provider.core.config import settings
from provider.core.logging import configure_logging
from provider.core.router import router

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="IDEN Core Server", version="0.0.1", lifespan=lifespan)


@app.middleware("http")
async def add_request_id(request: Request, call_next: Callable) -> Response | None:
    request_id = str(uuid.uuid4())

    request.state.request_id = request_id

    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)

    response = await call_next(request)
    return response


app.include_router(router, prefix=settings.iden_api_prefix)
