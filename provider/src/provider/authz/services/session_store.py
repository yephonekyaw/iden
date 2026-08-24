"""Browser login sessions, in Redis under a sliding TTL.

Not in Postgres: a session is ephemeral, and expiry should be the storage
layer's job rather than a cleanup job's.
"""

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from redis.asyncio import Redis

from provider.core.config import settings
from provider.core.security import generate_token, hash_token

COOKIE_NAME = "iden_session"


@dataclass
class Session:
    id: str
    user_id: UUID
    amr: list[str]
    authenticated_at: datetime


def _key(session_id: str) -> str:
    # Hashed like any other credential: a Redis dump must not yield usable
    # session ids.
    return f"session:{hash_token(session_id)}"


async def create(redis: Redis, user_id: UUID, method: str) -> Session:
    session = Session(
        id=generate_token(),
        user_id=user_id,
        amr=[method],
        authenticated_at=datetime.now(UTC),
    )
    await _save(redis, session)
    return session


async def _save(redis: Redis, session: Session) -> None:
    payload = json.dumps(
        {
            "user_id": str(session.user_id),
            "amr": session.amr,
            "authenticated_at": session.authenticated_at.isoformat(),
        }
    )
    await redis.set(_key(session.id), payload, ex=settings.iden_session_ttl)


async def get(redis: Redis, session_id: str | None) -> Session | None:
    if not session_id:
        return None

    raw = await redis.get(_key(session_id))
    if raw is None:
        return None

    # Sliding expiry: an active session should not be logged out mid-use.
    await redis.expire(_key(session_id), settings.iden_session_ttl)

    data = json.loads(raw)
    return Session(
        id=session_id,
        user_id=UUID(data["user_id"]),
        amr=data["amr"],
        authenticated_at=datetime.fromisoformat(data["authenticated_at"]),
    )


async def add_method(redis: Redis, session: Session, method: str) -> Session:
    """Record a step-up. The acr claim is recomputed from amr at issuance."""
    if method not in session.amr:
        session.amr.append(method)
        await _save(redis, session)
    return session


async def delete(redis: Redis, session_id: str) -> None:
    await redis.delete(_key(session_id))
