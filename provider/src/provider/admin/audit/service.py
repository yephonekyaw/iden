from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from provider.shared.models import AuditEvent


async def list_events(
    session: AsyncSession,
    *,
    limit: int,
    offset: int,
    actor_user_id: UUID | None = None,
    action: str | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
) -> tuple[list[AuditEvent], int]:
    query = select(AuditEvent)
    count = select(func.count(AuditEvent.id))

    filters = []
    if actor_user_id is not None:
        filters.append(AuditEvent.actor_user_id == actor_user_id)
    if action:
        filters.append(AuditEvent.action.ilike(f"%{action}%"))
    if since is not None:
        filters.append(AuditEvent.occurred_at >= since)
    if until is not None:
        filters.append(AuditEvent.occurred_at <= until)

    for condition in filters:
        query, count = query.where(condition), count.where(condition)

    total = await session.scalar(count) or 0
    events = list(
        await session.scalars(
            query.order_by(AuditEvent.occurred_at.desc(), AuditEvent.id.desc())
            .limit(limit)
            .offset(offset)
        )
    )
    return events, total
