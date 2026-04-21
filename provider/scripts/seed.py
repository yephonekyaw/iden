"""Idempotent dev bootstrap.

Enables the pgvector extension, creates all tables declared on ``Base.metadata``,
and upserts the canonical scope rows. Safe to re-run.
"""

import asyncio

import structlog

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert

import shared.models  # noqa: F401  — register ORM classes on Base.metadata
from core.db import Base, engine
from shared.models import Scope
from shared.scopes import ALL_SCOPES

logger = structlog.get_logger(__name__)


async def main() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

        for scope in ALL_SCOPES:
            stmt = insert(Scope).values(
                name=scope.name,
                description=scope.description,
                resource=scope.resource,
                allowed_roles=list(scope.allowed_roles),
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=[Scope.name],
                set_={
                    "description": stmt.excluded.description,
                    "resource": stmt.excluded.resource,
                    "allowed_roles": stmt.excluded.allowed_roles,
                },
            )
            await conn.execute(stmt)

    logger.info("db.scopes.seeded", count=len(ALL_SCOPES))


if __name__ == "__main__":
    asyncio.run(main())
