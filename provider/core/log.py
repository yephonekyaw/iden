"""Structured logging setup.

Call ``configure_logging()`` once at app startup. Output mode and level are
read from ``core.config.settings`` (``IDEN_ENV``, ``IDEN_LOG_LEVEL``):
production → single-line JSON; otherwise → colored console.

structlog and stdlib loggers share one processor chain, so uvicorn / fastapi /
third-party library logs come out with the same fields and formatting.
"""

import logging
import sys

import structlog

from core.config import settings


def configure_logging() -> None:
    is_prod = settings.env == "production"
    level = getattr(logging, settings.log_level)

    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    renderer = (
        structlog.processors.JSONRenderer()
        if is_prod
        else structlog.dev.ConsoleRenderer(colors=True)
    )

    structlog.configure(
        processors=shared_processors
        + [structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)

    # Route uvicorn's own loggers through the root handler instead of their
    # built-in ones so formatting stays uniform.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers = []
        lg.propagate = True
