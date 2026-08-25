from datetime import UTC, datetime

import pyotp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from provider.authz.login.errors import (
    InactiveUser,
    InvalidCredentials,
    InvalidTotpCode,
    TotpNotEnrolled,
)
from provider.core.security import hash_secret, verify_secret
from provider.shared.models import TotpCredential, User

# Verifying against this when no user matches keeps the response time of an
# unknown email indistinguishable from a wrong password, so the endpoint cannot
# be used to enumerate accounts.
_DUMMY_HASH = hash_secret("iden-timing-equalizer")


async def authenticate_password(
    session: AsyncSession, email: str, password: str
) -> User:
    user = await session.scalar(select(User).where(User.email == email))

    if user is None:
        verify_secret(_DUMMY_HASH, password)
        raise InvalidCredentials

    if not verify_secret(user.password_hash, password):
        raise InvalidCredentials

    if not user.is_active:
        raise InactiveUser

    user.last_login_at = datetime.now(UTC)
    return user


async def verify_totp(session: AsyncSession, user: User, code: str) -> None:
    credential = await session.scalar(
        select(TotpCredential).where(
            TotpCredential.user_id == user.id, TotpCredential.confirmed_at.is_not(None)
        )
    )
    if credential is None:
        raise TotpNotEnrolled

    # valid_window=1 accepts the adjacent 30s step, covering ordinary clock drift
    # between the phone and the server (RFC 6238 §6).
    if not pyotp.TOTP(credential.secret).verify(code, valid_window=1):
        raise InvalidTotpCode
