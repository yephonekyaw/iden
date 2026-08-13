import uuid
from collections.abc import Callable
from contextlib import asynccontextmanager

import structlog
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from server.core.config import settings
from server.core.logging import configure_logging
from server.core.router import router

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="SIT Cert Server", version="0.0.1", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.kiosk_allowed_origins,
    allow_credentials=True,
    allow_methods=("*"),
    allow_headers=("*"),
)


@app.middleware("http")
async def add_request_id(request: Request, call_next: Callable) -> Response | None:
    request_id = str(uuid.uuid4())

    request.state.request_id = request_id

    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)

    response = await call_next(request)
    return response


app.include_router(router, prefix=settings.kiosk_api_prefix)


def main():
    uvicorn.run("server.core.app:app", host="0.0.0.0", port=8080, log_config=None, reload=True)
