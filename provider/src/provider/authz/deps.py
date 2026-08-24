"""Shared request-scoped dependencies for the AuthZ module."""

from typing import Annotated

from fastapi import Depends, Request

from provider.authz import session_cookie
from provider.authz.services import session_store
from provider.authz.services.session_store import Session
from provider.core.redis import RedisDep


async def get_login_session(request: Request, redis: RedisDep) -> Session | None:
    """The browser's login session, or None. Routes decide what a missing
    session means — /authorize redirects to login, /totp rejects."""
    return await session_store.get(redis, request.cookies.get(session_cookie.NAME))


LoginSessionDep = Annotated[Session | None, Depends(get_login_session)]
