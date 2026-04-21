from fastapi import FastAPI

from admin import router as admin_router
from authz import router as authz_router
from biometric import router as biometric_router
from core.log import configure_logging
from core.middleware.cors import CORSMiddleware
from core.middleware.request_context import RequestContextMiddleware
from entity import router as entity_router

configure_logging()

app = FastAPI(title="IDEN Provider")
app.add_middleware(CORSMiddleware)
app.add_middleware(RequestContextMiddleware)

app.include_router(authz_router)
app.include_router(admin_router)
app.include_router(entity_router)
app.include_router(biometric_router)
