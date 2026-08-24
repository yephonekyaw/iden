"""Login and consent challenges.

A challenge carries the pending /authorize parameters across the redirect to
the Auth UI and back, so the browser never has to be trusted to preserve them
and the Auth UI never has to understand OAuth.
"""

import json
from dataclasses import dataclass
from urllib.parse import urlencode
from uuid import UUID

from redis.asyncio import Redis

from provider.core.config import settings
from provider.core.security import generate_token, hash_token


@dataclass
class Challenge:
    id: str
    params: dict[str, str]
    user_id: UUID | None = None


def _key(challenge_id: str) -> str:
    return f"challenge:{hash_token(challenge_id)}"


async def create(redis: Redis, params: dict[str, str]) -> Challenge:
    challenge = Challenge(id=generate_token(), params=params)
    await save(redis, challenge)
    return challenge


async def save(redis: Redis, challenge: Challenge) -> None:
    payload = json.dumps(
        {
            "params": challenge.params,
            "user_id": str(challenge.user_id) if challenge.user_id else None,
        }
    )
    await redis.set(_key(challenge.id), payload, ex=settings.iden_challenge_ttl)


async def get(redis: Redis, challenge_id: str | None) -> Challenge | None:
    if not challenge_id:
        return None

    raw = await redis.get(_key(challenge_id))
    if raw is None:
        return None

    data = json.loads(raw)
    return Challenge(
        id=challenge_id,
        params=data["params"],
        user_id=UUID(data["user_id"]) if data["user_id"] else None,
    )


async def delete(redis: Redis, challenge_id: str) -> None:
    await redis.delete(_key(challenge_id))


def resume_url(challenge: Challenge) -> str:
    """Where to send the browser once login or consent is done: back to
    /authorize with the original parameters, which is the only place that
    decides what happens next."""
    return f"{settings.iden_issuer}/oauth2/authorize?{urlencode(challenge.params)}"
