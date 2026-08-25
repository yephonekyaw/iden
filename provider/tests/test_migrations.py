"""The migrations and the models must agree.

A model edited without a matching revision is invisible until a deployment runs
`alembic upgrade head` and finds a column that was never added. This catches it
at the point the model changes instead.
"""

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Connection
from sqlalchemy.ext.asyncio import AsyncEngine

from provider.core.db import Base


def _differences(connection: Connection) -> list:
    context = MigrationContext.configure(connection, opts={"compare_type": True})
    return compare_metadata(context, Base.metadata)


async def test_migrations_reproduce_the_models(engine: AsyncEngine):
    """The `engine` fixture builds its database by running the migrations, so
    anything autogenerate still wants to do is a revision nobody wrote."""
    async with engine.connect() as connection:
        differences = await connection.run_sync(_differences)

    assert differences == [], (
        "the models and the migrations have drifted — run "
        "`uv run alembic revision --autogenerate -m '...'`"
    )
