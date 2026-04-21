"""Path-aware CORS middleware.

Three policies are selected by path prefix:

1. **Public metadata** (``/.well-known/*``, ``/jwks.json``) — allow any origin (``*``).
2. **Admin** (``/admin/*``) — static allowlist from ``settings.admin_allowed_origins``.
3. **OIDC endpoints hit by SPAs** (``/token``, ``/userinfo``, ``/revoke``, …)
   — dynamic allowlist extracted from the ``redirect_uris`` of registered
   public OIDC clients. Cached in memory with a short TTL so preflight
   traffic doesn't hit the DB on every request.

Starlette's built-in ``CORSMiddleware`` takes a static list and can't be
scoped per path, which is why this is custom.
"""

import time
from urllib.parse import urlparse

from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.config import settings
from core.db import async_session
from shared.models import OIDCClient

_ALLOW_METHODS = "GET, POST, PATCH, DELETE, OPTIONS"
_ALLOW_HEADERS = "Authorization, Content-Type"
_MAX_AGE = "600"
_CACHE_TTL_SECONDS = 60.0

_cached_origins: set[str] = set()
_cache_expires_at: float = 0.0


def _origin_of(uri: str) -> str | None:
    parsed = urlparse(uri)
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


async def _public_client_origins() -> set[str]:
    global _cached_origins, _cache_expires_at
    now = time.monotonic()
    if now < _cache_expires_at:
        return _cached_origins
    async with async_session() as session:
        rows = (
            await session.scalars(
                select(OIDCClient.redirect_uris).where(
                    OIDCClient.is_public.is_(True),
                    OIDCClient.status == "active",
                )
            )
        ).all()
    _cached_origins = {
        o for uris in rows for o in map(_origin_of, uris) if o is not None
    }
    _cache_expires_at = now + _CACHE_TTL_SECONDS
    return _cached_origins


def invalidate_origin_cache() -> None:
    """Call after creating/updating/deleting a public OIDC client so the next
    request reloads the allowlist instead of waiting for the TTL."""
    global _cache_expires_at
    _cache_expires_at = 0.0


async def _allowed_origin(path: str, origin: str) -> str | None:
    """Return the value to echo in ``Access-Control-Allow-Origin``, or ``None`` to reject."""
    if path.startswith("/.well-known/") or path == "/jwks.json":
        return "*"
    if path.startswith("/admin"):
        return origin if origin in settings.admin_allowed_origins else None
    if origin in await _public_client_origins():
        return origin
    return None


def _apply_cors_headers(response: Response, allow_origin: str) -> None:
    response.headers["Access-Control-Allow-Origin"] = allow_origin
    response.headers["Access-Control-Allow-Methods"] = _ALLOW_METHODS
    response.headers["Access-Control-Allow-Headers"] = _ALLOW_HEADERS
    response.headers["Access-Control-Max-Age"] = _MAX_AGE
    if allow_origin != "*":
        response.headers["Vary"] = "Origin"


class CORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        is_preflight = (
            request.method == "OPTIONS"
            and "access-control-request-method" in request.headers
        )

        if is_preflight:
            response = Response(status_code=204)
        else:
            response = await call_next(request)

        if origin:
            allow = await _allowed_origin(request.url.path, origin)
            if allow is not None:
                _apply_cors_headers(response, allow)

        return response
