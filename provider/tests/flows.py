"""Helpers for driving the authorization code flow in tests."""

import base64
import hashlib
import secrets
from urllib.parse import parse_qs, urlparse

from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, REDIRECT_URI

DEFAULT_SCOPE = "openid profile email admin:users:read entity:profile:read"


def pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(48)
    digest = hashlib.sha256(verifier.encode()).digest()
    return verifier, base64.urlsafe_b64encode(digest).decode().rstrip("=")


def query_of(response) -> dict[str, str]:
    return {
        k: v[0]
        for k, v in parse_qs(urlparse(response.headers["location"]).query).items()
    }


def authorize_params(challenge: str, **overrides) -> dict[str, str]:
    params = {
        "client_id": "dashboard",
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": DEFAULT_SCOPE,
        "state": "xyz",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "nonce": "n-1",
    }
    return params | overrides


async def start(client, challenge: str, **overrides):
    """GET /oauth2/authorize — returns the raw response."""
    return await client.get(
        "/oauth2/authorize", params=authorize_params(challenge, **overrides)
    )


async def sign_in(
    client, challenge_id: str, email=ADMIN_EMAIL, password=ADMIN_PASSWORD
):
    return await client.post(
        "/api/v1/auth/login",
        json={"challengeId": challenge_id, "email": email, "password": password},
    )


async def get_code(client, **overrides) -> tuple[str, str]:
    """Run the flow from a cold browser to an authorization code.

    Returns (code, code_verifier).
    """
    verifier, challenge = pkce_pair()

    response = await start(client, challenge, **overrides)
    challenge_id = query_of(response)["challenge"]

    login = await sign_in(client, challenge_id)
    resumed = await client.get(login.json()["resumeUrl"])

    return query_of(resumed)["code"], verifier


async def get_tokens(client, **overrides) -> dict:
    """Run the flow all the way to a token response."""
    code, verifier = await get_code(client, **overrides)
    response = await client.post(
        "/oauth2/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": verifier,
            "client_id": "dashboard",
        },
    )
    return response.json()
