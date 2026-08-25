from fastapi import APIRouter, Depends, Request, Response

from provider.authz import session_cookie
from provider.authz.logout import service as logout_service
from provider.authz.services import session_store
from provider.core.auth import require_fresh_auth, require_scope
from provider.core.db import DBSessionDep
from provider.core.redis import RedisDep
from provider.core.schemas import ErrorResponse
from provider.entity.deps import CurrentUserDep
from provider.entity.sessions.schemas import SessionListResponse, SessionSummary

router = APIRouter(prefix="/entity/sessions", tags=["entity: sessions"])

READ = Depends(require_scope("entity:sessions:read"))
REVOKE = Depends(require_scope("entity:sessions:revoke"))
FRESH = Depends(require_fresh_auth(max_age=300))


@router.get(
    "",
    response_model=SessionListResponse,
    summary="See where you are signed in",
    description=(
        "Every live session for this person, newest first, with the "
        "applications each one reached. That list is what makes signing a "
        "session out mean something — those are the applications that will be "
        "told.\n\n"
        "**Required scope:** `entity:sessions:read`"
    ),
    dependencies=[READ],
)
async def list_sessions(
    request: Request, user: CurrentUserDep, redis: RedisDep
) -> SessionListResponse:
    cookie = request.cookies.get(session_cookie.NAME)
    current = session_store.public_id_of(cookie) if cookie else None

    sessions = await session_store.list_for_user(redis, user.id)
    return SessionListResponse(
        sessions=[
            SessionSummary(
                id=session.id,
                current=session.id == current,
                authenticated_at=session.authenticated_at,
                amr=session.amr,
                clients=sorted(
                    await session_store.clients_for_public_id(redis, session.id)
                ),
            )
            for session in sessions
        ]
    )


@router.delete(
    "/{session_id}",
    status_code=204,
    summary="Sign one session out",
    description=(
        "Ends that session everywhere: its refresh tokens are revoked and every "
        "application it reached is sent a logout token, exactly as "
        "`/oauth2/logout` does for your own.\n\n"
        "**Needs a recent sign-in** — this is how someone locks an intruder "
        "out, so it must not be available to the intruder.\n\n"
        "Returns `204` whether or not the session existed: a different answer "
        "would tell a caller which session ids are real.\n\n"
        "**Required scope:** `entity:sessions:revoke`"
    ),
    responses={403: {"model": ErrorResponse, "description": "Sign-in is not recent"}},
    dependencies=[REVOKE, FRESH],
)
async def revoke_session(
    session_id: str,
    user: CurrentUserDep,
    session: DBSessionDep,
    redis: RedisDep,
) -> Response:
    clients = await session_store.clients_for_public_id(redis, session_id)

    if await session_store.delete_by_public_id(redis, user.id, session_id):
        await logout_service.revoke_session_tokens(session, session_id)
        await logout_service.notify(
            session, client_ids=clients, subject=user.id, sid=session_id
        )
        await session.commit()

    return Response(status_code=204)
