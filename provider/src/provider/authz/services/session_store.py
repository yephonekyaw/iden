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

    @property
    def public_id(self) -> str:
        """The `sid` claim: a hash of the session id, never the id itself.

        `id` is the cookie value — a bearer credential. Publishing it to every
        client in every ID token would hand each of them, and anyone who read a
        token in transit, the ability to set that cookie and become the user.
        The hash names the session without being usable as one.
        """
        return hash_token(self.id)


def _key(session_id: str) -> str:
    # Hashed like any other credential: a Redis dump must not yield usable
    # session ids.
    return f"session:{hash_token(session_id)}"


def _clients_key(session_id: str) -> str:
    """The clients a session has signed into.

    Sign-out has to notify the applications this session reached, and there is
    no other record of which those were: an authorization code is short-lived
    and a refresh token may never have been issued. Keyed by the same hash as
    the session, so it is unreadable from a Redis dump and expires with it.
    """
    return f"session_clients:{hash_token(session_id)}"


def _user_key(user_id: UUID) -> str:
    """Index of a user's live sessions.

    Sessions are keyed by a hash of an id nobody but the browser holds, so
    without this index there is no way to answer "sign me out everywhere" or to
    invalidate sessions when a password changes.
    """
    return f"user_sessions:{user_id}"


async def create(redis: Redis, user_id: UUID, method: str) -> Session:
    session = Session(
        id=generate_token(),
        user_id=user_id,
        amr=[method],
        authenticated_at=datetime.now(UTC),
    )
    await _save(redis, session)
    await redis.sadd(_user_key(user_id), _key(session.id))
    await redis.expire(_user_key(user_id), settings.iden_session_ttl)
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


async def add_client(redis: Redis, session_id: str, client_id: str) -> None:
    """Record that this session issued a code to a client."""
    await redis.sadd(_clients_key(session_id), client_id)
    await redis.expire(_clients_key(session_id), settings.iden_session_ttl)


async def clients_for(redis: Redis, session_id: str) -> set[str]:
    # The client is built with decode_responses=True, so members come back as
    # str; the type stubs describe both shapes.
    return {str(value) for value in await redis.smembers(_clients_key(session_id))}


async def reauthenticate(redis: Redis, session: Session, method: str) -> Session:
    """A fresh authentication on an existing session — `prompt=login`, or a
    `max_age` the session no longer satisfies.

    The session id is kept. Replacing it would strand the old one in Redis with
    no cookie pointing at it, and would break sign-out for every application
    that was told the old `sid`.
    """
    session.amr = [method]
    session.authenticated_at = datetime.now(UTC)
    await _save(redis, session)
    return session


async def add_method(redis: Redis, session: Session, method: str) -> Session:
    """Record a step-up. The acr claim is recomputed from amr at issuance."""
    if method not in session.amr:
        session.amr.append(method)
        await _save(redis, session)
    return session


async def delete(redis: Redis, session_id: str) -> None:
    session = await get(redis, session_id)
    await redis.delete(_key(session_id), _clients_key(session_id))
    if session is not None:
        await redis.srem(_user_key(session.user_id), _key(session_id))


async def delete_all_for_user(redis: Redis, user_id: UUID) -> int:
    """Sign a user out everywhere. Used when a password changes or an account
    is deactivated — a credential change that leaves old sessions alive has not
    really taken effect."""
    keys = [str(key) for key in await redis.smembers(_user_key(user_id))]
    if keys:
        # The index stores session keys; the client set for each is the same
        # hash under a different prefix, so both go in one delete.
        await redis.delete(
            *keys, *(key.replace("session:", "session_clients:", 1) for key in keys)
        )
    await redis.delete(_user_key(user_id))
    return len(keys)
