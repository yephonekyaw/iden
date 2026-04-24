import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class Meta(BaseModel):
    endpoint: str
    timestamp: str
    request_id: str


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorInfo(BaseModel):
    code: str
    details: list[ErrorDetail] | None = None


class SuccessResponse(BaseModel):
    success: bool = True
    status: int
    data: Any
    message: str
    meta: Meta


class ErrorResponse(BaseModel):
    success: bool = False
    status: int
    data: None = None
    message: str
    error: ErrorInfo
    meta: Meta


def _meta(request: Request) -> Meta:
    return Meta(
        endpoint=request.url.path,
        timestamp=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        request_id=request.state.request_id,
    )


def success(request: Request, data: Any, message: str, status: int = 200) -> JSONResponse:
    body = SuccessResponse(status=status, data=data, message=message, meta=_meta(request))
    return JSONResponse(status_code=status, content=body.model_dump())


def error(
    request: Request,
    *,
    code: str,
    message: str,
    status: int,
    details: list[ErrorDetail] | None = None,
) -> JSONResponse:
    body = ErrorResponse(
        status=status,
        message=message,
        error=ErrorInfo(code=code, details=details),
        meta=_meta(request),
    )
    return JSONResponse(status_code=status, content=body.model_dump())


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        details = [
            ErrorDetail(
                field=".".join(str(p) for p in err["loc"] if p != "body"),
                message=err["msg"],
            )
            for err in exc.errors()
        ]
        return error(
            request,
            code="VALIDATION_ERROR",
            message="Invalid request payload",
            status=400,
            details=details,
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s", request.url.path)
        return error(
            request,
            code="INTERNAL_ERROR",
            message=f"{type(exc).__name__}: {exc}",
            status=500,
        )
