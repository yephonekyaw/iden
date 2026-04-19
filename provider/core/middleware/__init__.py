from __future__ import annotations

import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = structlog.get_logger(__name__)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Bind a request-scoped context (request_id, method, path) and log the
    access line once the response is ready. Every log emitted during the
    request automatically carries these fields."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )

        start = time.perf_counter()
        try:
            response: Response = await call_next(request)
        except Exception:
            logger.exception("request.failed")
            raise

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info(
            "request.completed",
            status=response.status_code,
            duration_ms=duration_ms,
        )
        response.headers["x-request-id"] = request_id
        return response
