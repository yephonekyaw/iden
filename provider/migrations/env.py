"""Alembic environment.

The database URL comes from IDEN's settings rather than from `alembic.ini`, so
there is one source of truth for it and no credentials in a committed file.
"""

import asyncio

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from provider.core.config import settings
from provider.core.db import Base
from provider.shared import models  # noqa: F401

# `models` is imported for its side effect: defining the classes is what
# registers their tables on Base.metadata, and autogenerate compares against
# whatever is registered at import time.
target_metadata = Base.metadata

config = context.config
# An explicitly configured URL wins so the test suite can point migrations at
# its own database; otherwise settings are the single source of truth.
if not config.get_main_option("sqlalchemy.url", None):
    config.set_main_option("sqlalchemy.url", settings.iden_database_url)

if config.config_file_name is not None:
    from logging.config import fileConfig

    fileConfig(config.config_file_name)


def run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # Without this, autogenerate sees no difference between String(64) and
        # String(128) — a column that outgrew its width would silently drift.
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_online() -> None:
    engine = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with engine.connect() as connection:
        await connection.run_sync(run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    # `alembic upgrade head --sql` prints the DDL instead of applying it, for
    # review or for a DBA to run by hand.
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(run_online())
