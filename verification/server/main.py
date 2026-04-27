import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from capture import router as capture_router
from config import settings
from db import init_db
from face import warm_up
from middleware import RequestContextMiddleware
from responses import register_error_handlers
from verify import router as verify_router

logging.basicConfig(level=settings.log_level.upper())


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    await run_in_threadpool(warm_up)
    yield


app = FastAPI(title="IDEN Verification Server", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestContextMiddleware)
register_error_handlers(app)
app.include_router(capture_router, prefix="/api/v1")
app.include_router(verify_router, prefix="/api/v1")


@app.get(
    "/healthz",
    tags=["health"],
    summary="Liveness probe",
    description="Returns `{\"status\": \"ok\"}` once the face model is loaded.",
)
async def healthz():
    return {"status": "ok"}
