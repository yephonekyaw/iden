from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from provider.admin.audit import service
from provider.admin.audit.schemas import AuditEventResponse
from provider.core.auth import require_scope
from provider.core.db import DBSessionDep
from provider.core.schemas import Page, PageMeta, PaginationDep

router = APIRouter(prefix="/admin/audit", tags=["admin: audit"])

READ = Depends(require_scope("admin:audit:read"))


@router.get(
    "",
    response_model=Page[AuditEventResponse],
    summary="Read the audit log",
    description=(
        "Every state-changing request, newest first: who did it, what they did, "
        "when, and from where.\n\n"
        "The log is append-only and has no write endpoint — entries are created "
        "by the request they describe and can never be edited or deleted through "
        "the API. Reads are not recorded; only requests that change something "
        "are, along with the ones that tried and were refused.\n\n"
        "**Required scope:** `admin:audit:read`"
    ),
    dependencies=[READ],
)
async def list_events(
    session: DBSessionDep,
    page: PaginationDep,
    actor_user_id: UUID | None = Query(
        None, alias="actorUserId", description="Only what this user did."
    ),
    action: str | None = Query(
        None, description="Case-insensitive substring, e.g. `/admin/roles`."
    ),
    since: datetime | None = Query(None, description="Inclusive lower bound."),
    until: datetime | None = Query(None, description="Inclusive upper bound."),
) -> Page[AuditEventResponse]:
    events, total = await service.list_events(
        session,
        limit=page.limit,
        offset=page.offset,
        actor_user_id=actor_user_id,
        action=action,
        since=since,
        until=until,
    )

    return Page[AuditEventResponse](
        items=[AuditEventResponse.model_validate(event) for event in events],
        meta=PageMeta(total=total, limit=page.limit, offset=page.offset),
    )
