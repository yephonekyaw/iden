"""The dependency every Entity route starts from.

The user comes from the token's `sub`, never from a path or a body. No route in
this module accepts a user id, which removes an entire class of IDOR bugs by
construction rather than by remembering to check.
"""

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException

from provider.core.auth import AccessToken, CurrentTokenDep
from provider.core.db import DBSessionDep
from provider.shared.models import User


async def get_current_user(token: CurrentTokenDep, session: DBSessionDep) -> User:
    user = await session.get(User, uuid.UUID(token.subject))
    if user is None or not user.is_active:
        # The token is valid but its subject is gone or disabled. 401, not 404:
        # the caller needs to authenticate again, not look somewhere else.
        raise HTTPException(
            status_code=401,
            detail="This account is no longer active.",
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        )
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def token_of(token: AccessToken) -> AccessToken:
    return token
