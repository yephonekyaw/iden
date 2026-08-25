"""Consent, including the scopes a grant actually records."""

import pytest
from sqlalchemy import select

from provider.shared.models import ConsentGrant
from tests.conftest import THIRD_PARTY_REDIRECT
from tests.flows import pkce_pair, query_of, sign_in, start

pytestmark = pytest.mark.usefixtures("admin_user")


async def reach_consent(client, scope: str) -> str:
    """Sign in against the third-party client and return the consent challenge id."""
    _, challenge = pkce_pair()
    params = {
        "client_id": "library",
        "redirect_uri": THIRD_PARTY_REDIRECT,
        "scope": scope,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }

    response = await start(client, challenge, **params)
    challenge_id = query_of(response)["challenge"]

    login = await sign_in(client, challenge_id)
    resumed = await client.get(login.json()["resumeUrl"])

    assert "/auth/consent" in resumed.headers["location"], "expected a consent prompt"
    return query_of(resumed)["challenge"]


async def test_a_third_party_client_must_ask(client, third_party):
    await reach_consent(client, "openid entity:profile:read")


async def test_approval_lets_the_flow_continue(client, third_party):
    challenge_id = await reach_consent(client, "openid entity:profile:read")

    response = await client.post(
        "/api/v1/auth/consent", json={"challengeId": challenge_id, "approved": True}
    )
    resumed = await client.get(response.json()["redirectUrl"])

    assert "code=" in resumed.headers["location"]


async def test_denial_returns_access_denied_to_the_client(client, third_party):
    challenge_id = await reach_consent(client, "openid entity:profile:read")

    response = await client.post(
        "/api/v1/auth/consent", json={"challengeId": challenge_id, "approved": False}
    )

    assert response.json()["redirectUrl"].startswith(THIRD_PARTY_REDIRECT)
    assert "error=access_denied" in response.json()["redirectUrl"]


async def test_the_user_is_asked_only_once(client, third_party):
    challenge_id = await reach_consent(client, "openid entity:profile:read")
    approval = await client.post(
        "/api/v1/auth/consent", json={"challengeId": challenge_id, "approved": True}
    )
    await client.get(approval.json()["redirectUrl"])

    _, challenge = pkce_pair()
    again = await start(
        client,
        challenge,
        client_id="library",
        redirect_uri=THIRD_PARTY_REDIRECT,
        scope="openid entity:profile:read",
        code_challenge=challenge,
    )

    assert "code=" in again.headers["location"]


async def test_consent_records_what_was_granted_not_what_was_asked(
    client, db, third_party, unheld_scope
):
    """KI-4. Recording the raw request banks consent for scopes that were pruned
    because the user did not hold them — so a role granted later would be used
    without ever asking again."""
    challenge_id = await reach_consent(
        client, f"openid entity:profile:read {unheld_scope.value}"
    )

    approval = await client.post(
        "/api/v1/auth/consent", json={"challengeId": challenge_id, "approved": True}
    )
    await client.get(approval.json()["redirectUrl"])

    grant = await db.scalar(select(ConsentGrant))

    assert unheld_scope.value not in grant.scopes
    assert "entity:profile:read" in grant.scopes
