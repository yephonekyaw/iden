import uuid
from collections.abc import Callable
from contextlib import asynccontextmanager

import structlog
import uvicorn
from fastapi import FastAPI, Request, Response

from engine.core.config import settings
from engine.core.logging import configure_logging, logger
from engine.core.router import router
from engine.models.face_engine import face_engine
from engine.models.liveness import liveness_checker

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Engine starting", providers=settings.engine_providers)
    face_engine.load()
    liveness_checker.load()
    yield


app = FastAPI(
    title="IDEN Biometric Engine",
    version="0.0.1",
    description=(
        "Internal-only face detection, embedding, and liveness service. "
        "Reachable only from the provider's Biometric RS — see the root "
        "README's architecture section."
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


app.include_router(router)


def main():
    uvicorn.run(
        "engine.core.app:app",
        host="0.0.0.0",
        port=8000,
        log_config=None,
        reload=settings.engine_env == "dev",
    )
