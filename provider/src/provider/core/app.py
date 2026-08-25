import uuid
from collections.abc import Callable
from urllib.parse import urlencode
from contextlib import asynccontextmanager

import structlog
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from provider.core import redis as redis_module
from provider.core.audit import AuditMiddleware
from provider.core.config import settings
from provider.core.db import engine
from provider.authz.oauth.errors import OAuthError, RedirectableError
from provider.core.errors import (
    ConflictError,
    IdenError,
    ImmutableError,
    NotFoundError,
    ValidationError,
)
from provider.core.logging import configure_logging, logger
from provider.core.router import router
from provider.core.schemas import ErrorResponse

configure_logging()

# Domain errors carry no HTTP knowledge, so the mapping lives here — the one
# place that knows both vocabularies. Matched by class rather than by code, so a
# package can raise `ApiNotFound` with its own message and still land on 404.
# Most specific first: ImmutableError is a ConflictError.
ERROR_STATUS = (
    (NotFoundError, 404),
    (ImmutableError, 409),
    (ConflictError, 409),
    (ValidationError, 422),
)


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
    """Translate a domain exception into the documented JSON error shape.

    Central rather than per-route: the mapping is uniform across every
    resource, and thirty routes each repeating the same try/except would add
    noise without adding meaning. Routes still declare their failures in
    `responses={...}` so `/docs` stays accurate.
    """
    status_code = next(
        (code for cls, code in ERROR_STATUS if isinstance(exc, cls)), 500
    )
    if status_code >= 500:
        logger.error("Unmapped domain error", code=exc.code, path=request.url.path)

    body = ErrorResponse(code=exc.code, message=exc.message, details=exc.details)
    return JSONResponse(status_code=status_code, content=body.model_dump(by_alias=True))


@app.exception_handler(RedirectableError)
async def handle_redirectable_error(
    request: Request, exc: RedirectableError
) -> RedirectResponse:
    """Deliver the error to the client's redirect_uri — RFC 6749 §4.1.2.1.

    Only reachable after client_id and redirect_uri have been validated.
    """
    params = {"error": exc.error, "error_description": exc.description}
    if exc.state:
        params["state"] = exc.state
    return RedirectResponse(f"{exc.redirect_uri}?{urlencode(params)}", status_code=303)


@app.exception_handler(OAuthError)
async def handle_oauth_error(request: Request, exc: OAuthError) -> JSONResponse:
    """RFC 6749 §5.2 fixes this shape; a client library will not understand
    the project's own error contract here."""
    headers = (
        {"WWW-Authenticate": 'Basic realm="iden"'} if exc.status_code == 401 else None
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.error, "error_description": exc.description},
        headers=headers,
    )


# Every state-changing request leaves a permanent record. Added before CORS so
# it wraps the routing that populates the route template it records.
app.add_middleware(AuditMiddleware)

# Credentialed requests from the hosted Auth UI and the dashboard: the session
# cookie must ride along, which requires an explicit origin allow-list.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.iden_auth_ui_base_url,
        *settings.iden_allowed_admin_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix=settings.iden_api_prefix)


def main():
    uvicorn.run(
        "provider.core.app:app", host="0.0.0.0", port=8000, log_config=None, reload=True
    )
