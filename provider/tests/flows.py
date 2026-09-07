"""Helpers for driving the authorization code flow in tests."""

import base64
import hashlib
import secrets
from urllib.parse import parse_qs, urlparse

from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, REDIRECT_URI

# `offline_access` is what asks for a refresh token (OIDC Core Section 11), so it
# belongs in the default any test about refreshing starts from. A test about
# *not* getting one overrides `scope` to leave it out.
DEFAULT_SCOPE = (
    "openid profile email offline_access admin:users:read entity:profile:read"
)


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
    """Run the flow to an authorization code, signing in only if needed.

    A warm browser goes straight from /authorize to a code — that is single
    sign-on, and it means a test can call this twice to model two applications.

    Returns (code, code_verifier).
    """
    verifier, challenge = pkce_pair()

    response = await start(client, challenge, **overrides)
    query = query_of(response)
    if "code" in query:
        return query["code"], verifier

    login = await sign_in(client, query["challenge"])
    resumed = await client.get(login.json()["resumeUrl"])

    return query_of(resumed)["code"], verifier


async def get_tokens(client, *, client_secret: str | None = None, **overrides) -> dict:
    """Run the flow all the way to a token response.

    Overrides that name a different client are carried through to the token
    exchange as well: `client_id` and `redirect_uri` must match what /authorize
    was given, and a confidential client also has to present its secret.
    """
    code, verifier = await get_code(client, **overrides)
    body = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": overrides.get("redirect_uri", REDIRECT_URI),
        "code_verifier": verifier,
        "client_id": overrides.get("client_id", "dashboard"),
    }
    if client_secret is not None:
        body["client_secret"] = client_secret

    response = await client.post("/oauth2/token", data=body)
    return response.json()
