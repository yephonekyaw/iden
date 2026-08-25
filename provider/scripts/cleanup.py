"""Delete authorization codes and refresh tokens that have expired.

Neither table has ever been pruned, so both grow for the life of the
deployment — a busy IdP mints a refresh token per login and a code per
authorization. Nothing breaks; the database just gets larger forever.

    uv run python -m scripts.cleanup            # delete
    uv run python -m scripts.cleanup --dry-run  # count only

Run it on a schedule — cron, a Kubernetes CronJob, or a systemd timer. Not an
in-process background task: every replica would race on the same rows, and a
job you cannot run by hand is a job you cannot debug.

`audit_events` is deliberately absent. It is the history of who did what, and
a retention policy for it is an organizational decision, not a maintenance one.
"""

import asyncio
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from provider.core.db import engine, session_factory
from provider.shared.models import AuthorizationCode, RefreshToken

# Expiry plus a margin, rather than expiry, so a row is never deleted out from
# under a request that is still deciding what to do with it — including a
# machine whose clock runs behind.
MARGIN = timedelta(hours=1)

# Only past `expires_at`, never merely revoked: reuse detection works by finding
# the spent row and revoking its family, so deleting a revoked-but-unexpired
# token would turn a detectable theft into an ordinary `invalid_grant`.
TABLES = (AuthorizationCode, RefreshToken)


async def expired_before(session: AsyncSession, cutoff: datetime) -> dict[str, int]:
    counts = {}
    for table in TABLES:
        counts[table.__tablename__] = (
            await session.scalar(
                select(func.count()).select_from(table).where(table.expires_at < cutoff)
            )
            or 0
        )
    return counts


async def delete_expired(session: AsyncSession, cutoff: datetime) -> dict[str, int]:
    # Counted in the same transaction as the delete, so the number reported is
    # the number removed.
    counts = await expired_before(session, cutoff)
    for table in TABLES:
        await session.execute(delete(table).where(table.expires_at < cutoff))
    await session.commit()
    return counts


async def main() -> None:
    dry_run = "--dry-run" in sys.argv
    cutoff = datetime.now(UTC) - MARGIN

    async with session_factory() as session:
        counts = await (
            expired_before(session, cutoff)
            if dry_run
            else delete_expired(session, cutoff)
        )

    await engine.dispose()

    verb = "Would delete" if dry_run else "Deleted"
    for table, count in counts.items():
        print(f"{verb} {count} rows from {table}.")


if __name__ == "__main__":
    asyncio.run(main())
