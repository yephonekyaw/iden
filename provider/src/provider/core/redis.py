from typing import Annotated

from fastapi import Depends
from redis.asyncio import Redis

from provider.core.config import settings

client = Redis.from_url(settings.iden_redis_url, decode_responses=True)


def get_redis() -> Redis:
    return client


RedisDep = Annotated[Redis, Depends(get_redis)]
