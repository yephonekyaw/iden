"""Races that a sequential test cannot see.

Driving these over HTTP does not work, and neither does `asyncio.gather` on two
service calls: whether the two transactions interleave at the critical section
is a matter of timing, so the test passes with or without the fix and proves
nothing.

Instead each test holds the first transaction open and asserts the second
**blocks** — which is what the row lock is for. Without the lock the second call
sails through, the assertion fails, and the race is demonstrated rather than
hoped for.
"""

import asyncio
from datetime import timedelta

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from provider.authz.oauth.errors import InvalidGrant
from provider.authz.oauth.service import consume_code
from provider.authz.services import token_service as tokens
from provider.authz.services.pkce import create_challenge
from provider.core.security import generate_token, hash_token
from provider.shared.models import AuthorizationCode

pytestmark = pytest.mark.usefixtures("catalogue")

VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
REDIRECT = "http://localhost:5173/callback"

# Long enough for an unblocked call to finish, short enough not to slow the suite.
SETTLE = 0.25


async def test_a_second_redemption_blocks_until_the_first_commits(
    engine, db, admin_user, dashboard
):
    """KI-3. Single use has to survive a race, not merely a sequence — that is
    the property that makes an intercepted authorization code survivable
    (RFC 6749 §4.1.2)."""
    code = generate_token()
    db.add(
        AuthorizationCode(
            code_hash=hash_token(code),
            client_id=dashboard.id,
            user_id=admin_user.id,
            redirect_uri=REDIRECT,
            scope="openid",
            code_challenge=create_challenge(VERIFIER),
            code_challenge_method="S256",
            acr="iden:loa:1",
            amr=["pwd"],
            sid="session-under-test",
            authenticated_at=tokens.now(),
            expires_at=tokens.now() + timedelta(minutes=1),
        )
    )
    await db.commit()

    factory = async_sessionmaker(engine, expire_on_commit=False)
    redeem = lambda session: consume_code(  # noqa: E731
        session,
        code=code,
        client=dashboard,
        redirect_uri=REDIRECT,
        code_verifier=VERIFIER,
    )

    async with factory() as first, factory() as second:
        await redeem(first)  # claims the row; transaction stays open

        pending = asyncio.create_task(redeem(second))
        await asyncio.sleep(SETTLE)

        assert not pending.done(), "second redemption was not blocked by the first"

        await first.commit()

        with pytest.raises(InvalidGrant):
            await asyncio.wait_for(pending, timeout=5)


async def test_a_second_refresh_blocks_until_the_first_commits(
    engine, db, admin_user, dashboard
):
    """KI-3. Without the lock both callers see an unrotated token, both rotate,
    and reuse detection never fires."""
    token, record = await tokens.issue_refresh_token(
        db,
        client=dashboard,
        user=admin_user,
        scope="openid",
        acr="iden:loa:1",
        amr=["pwd"],
        authenticated_at=tokens.now(),
    )
    await db.commit()

    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as first, factory() as second:
        claimed = await tokens.consume_refresh_token(first, token)
        claimed.revoked_at = tokens.now()  # type: ignore
        await first.flush()

        pending = asyncio.create_task(tokens.consume_refresh_token(second, token))
        await asyncio.sleep(SETTLE)

        assert not pending.done(), "second refresh was not blocked by the first"

        await first.commit()

        with pytest.raises(tokens.RefreshTokenReuse):
            await asyncio.wait_for(pending, timeout=5)
        await second.rollback()
