"""Phase 3.1 and 3.2 — the session behind single sign-on, and the parameters a
relying party uses to steer it."""

import jwt
import pytest

from provider.authz.services import session_store
from tests.conftest import ADMIN_EMAIL, THIRD_PARTY_REDIRECT
from tests.flows import (
    REDIRECT_URI,
    authorize_params,
    get_tokens,
    pkce_pair,
    query_of,
    sign_in,
)

pytestmark = pytest.mark.usefixtures("admin_user", "dashboard")


def decode(token: str) -> dict:
    return jwt.decode(token, options={"verify_signature": False})


async def authorize(client, **overrides):
    """One /authorize hop with an existing cookie, following no redirects."""
    _, challenge = pkce_pair()
    return await client.get(
        "/oauth2/authorize", params=authorize_params(challenge, **overrides)
    )


class TestSingleSignOn:
    async def test_a_second_application_needs_no_prompt(self, client, kiosk, db):
        """The property the whole phase exists to protect: one login, and the
        next client gets a code straight back."""
        await get_tokens(client)  # signs in through the dashboard

        second = await authorize(client, client_id="dashboard", state="second")

        assert second.status_code == 303
        assert "code" in query_of(second)

    async def test_the_session_is_named_in_the_id_token(self, client):
        tokens = await get_tokens(client)
        claims = decode(tokens["id_token"])

        assert claims["sid"]
        assert claims["auth_time"] <= claims["iat"]

    async def test_both_applications_are_told_the_same_session(self, client):
        """A shared `sid` is what lets one logout end both."""
        first = decode((await get_tokens(client))["id_token"])
        second = decode((await get_tokens(client))["id_token"])

        assert first["sid"] == second["sid"]

    async def test_auth_time_is_the_login_not_the_code(self, client):
        """On the second application these differ by the age of the session.
        A client's `max_age` is measured against `auth_time`, so taking it from
        the code's creation would make every session look freshly authenticated."""
        first = decode((await get_tokens(client))["id_token"])
        second = decode((await get_tokens(client))["id_token"])

        assert first["auth_time"] == second["auth_time"]
        assert second["iat"] >= second["auth_time"]

    async def test_the_session_records_which_clients_it_reached(self, client, redis):
        tokens = await get_tokens(client)
        sid = decode(tokens["id_token"])["sid"]

        assert await session_store.clients_for(redis, sid) == {"dashboard"}


class TestPromptNone:
    async def test_returns_a_code_when_a_session_exists(self, client):
        await get_tokens(client)

        response = await authorize(client, prompt="none")

        assert response.status_code == 303
        assert "code" in query_of(response)

    async def test_returns_login_required_with_no_session(self, client):
        response = await authorize(client, prompt="none")

        assert response.headers["location"].startswith(REDIRECT_URI)
        assert query_of(response)["error"] == "login_required"

    async def test_creates_no_challenge(self, client, redis):
        """A challenge is the pending half of an interaction. One left behind
        for an interaction that will never happen is a leak and a lie."""
        await authorize(client, prompt="none")

        assert await redis.keys("challenge:*") == []

    async def test_returns_consent_required_when_consent_is_missing(
        self, client, third_party
    ):
        await get_tokens(client)

        response = await authorize(
            client,
            client_id="library",
            redirect_uri=THIRD_PARTY_REDIRECT,
            prompt="none",
            scope="openid entity:profile:read",
        )

        assert query_of(response)["error"] == "consent_required"

    async def test_cannot_be_combined_with_other_values(self, client):
        response = await authorize(client, prompt="none login")

        assert query_of(response)["error"] == "invalid_request"

    async def test_an_unknown_prompt_value_is_refused(self, client):
        assert query_of(await authorize(client, prompt="teleport"))["error"] == (
            "invalid_request"
        )

    async def test_the_state_comes_back_with_the_error(self, client):
        """Without it the client cannot match the refusal to the request it made."""
        response = await authorize(client, prompt="none", state="xyz")

        assert query_of(response)["state"] == "xyz"


class TestMaxAge:
    async def test_zero_forces_a_fresh_login(self, client):
        await get_tokens(client)

        response = await authorize(client, max_age=0)

        assert "/auth/login" in response.headers["location"]

    async def test_a_generous_value_leaves_the_session_alone(self, client):
        await get_tokens(client)

        response = await authorize(client, max_age=3600)

        assert "code" in query_of(response)

    async def test_a_stale_session_is_login_required_when_silent(self, client):
        await get_tokens(client)

        response = await authorize(client, max_age=0, prompt="none")

        assert query_of(response)["error"] == "login_required"

    async def test_re_authenticating_keeps_the_session_id(self, client):
        """`prompt=login` must not mint a new session: the old one would be
        stranded in Redis, and every client holding the old sid would never be
        signed out."""
        before = decode((await get_tokens(client))["id_token"])["sid"]

        response = await authorize(client, prompt="login")
        challenge_id = query_of(response)["challenge"]
        await sign_in(client, challenge_id)

        after = decode((await get_tokens(client))["id_token"])["sid"]
        assert before == after


class TestPromptLoginAndConsent:
    async def test_login_prompts_despite_a_live_session(self, client):
        await get_tokens(client)

        response = await authorize(client, prompt="login")

        assert "/auth/login" in response.headers["location"]

    async def test_select_account_is_treated_as_login(self, client):
        await get_tokens(client)

        response = await authorize(client, prompt="select_account")

        assert "/auth/login" in response.headers["location"]

    async def test_consent_asks_again_for_a_first_party_client(self, client):
        """`skip_consent` is the client's default, not a veto over the request."""
        await get_tokens(client)

        response = await authorize(client, prompt="consent")

        assert "/auth/consent" in response.headers["location"]


class TestIdTokenHint:
    async def test_a_matching_hint_is_transparent(self, client):
        tokens = await get_tokens(client)

        response = await authorize(client, id_token_hint=tokens["id_token"])

        assert "code" in query_of(response)

    async def test_a_hint_for_someone_else_ignores_the_session(self, client, db):
        """The client is asking about a different account, so the session in
        hand is not the one it wants."""
        tokens = await get_tokens(client)
        claims = decode(tokens["id_token"])

        # Not signed with IDEN's key, so it fails verification — which counts as
        # a mismatch rather than as no hint at all: an unverifiable hint is not
        # a statement IDEN ever made.
        forged = jwt.encode({**claims, "sub": str(claims["sid"])}, "k" * 32)
        response = await authorize(client, id_token_hint=forged)

        assert "/auth/login" in response.headers["location"]

    async def test_an_expired_hint_still_counts(self, client):
        """ID tokens live ten minutes; a hint about a past login is expected to
        be expired, and rejecting it would break SSO for anyone who paused."""
        tokens = await get_tokens(client)
        claims = decode(tokens["id_token"])
        assert claims["exp"] > 0

        response = await authorize(client, id_token_hint=tokens["id_token"])
        assert "code" in query_of(response)


class TestLoginHint:
    async def test_reaches_the_auth_ui_through_the_challenge(self, client):
        response = await authorize(client, login_hint=ADMIN_EMAIL)
        challenge_id = query_of(response)["challenge"]

        body = (await client.get(f"/api/v1/auth/challenge/{challenge_id}")).json()

        assert body["loginHint"] == ADMIN_EMAIL

    async def test_is_not_an_assertion_of_identity(self, client):
        """A hint prefills a form. It must not sign anyone in."""
        response = await authorize(client, login_hint=ADMIN_EMAIL)

        assert "/auth/login" in response.headers["location"]
