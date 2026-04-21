"""Async SQLAlchemy engine, session, and declarative base.

The engine is created once at import time. Per-request sessions are obtained
via ``get_session`` (used as a FastAPI dependency). ``expire_on_commit=False``
is important for async sessions — it prevents SQLAlchemy from lazily re-loading
attributes after ``commit()``, which would trigger implicit I/O outside the
session scope.
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(settings.database_url)

async_session = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with async_session() as session:
        yield session
