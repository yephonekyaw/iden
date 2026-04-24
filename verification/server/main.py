from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from capture import router as capture_router
from db import init_db
from middleware import RequestContextMiddleware
from responses import register_error_handlers
from verify import router as verify_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(title="IDEN Verification Server", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestContextMiddleware)
register_error_handlers(app)
app.include_router(capture_router, prefix="/api/v1")
app.include_router(verify_router, prefix="/api/v1")
