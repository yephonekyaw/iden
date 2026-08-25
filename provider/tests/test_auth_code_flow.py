import jwt
import pytest

from tests.conftest import ADMIN_EMAIL, REDIRECT_URI
from tests.flows import (
    DEFAULT_SCOPE,
    get_code,
    get_tokens,
    pkce_pair,
    query_of,
    sign_in,
    start,
)

pytestmark = pytest.mark.usefixtures("admin_user", "dashboard")


def decode(token: str) -> dict:
    return jwt.decode(token, options={"verify_signature": False})


class TestAuthorizeValidation:
    async def test_unknown_client_renders_json_and_never_redirects(self, client):
        """Before client_id and redirect_uri are validated the URI is unverified,
        and redirecting to it would make this an open redirector."""
        response = await client.get(
            "/oauth2/authorize",
            params={
                "client_id": "nope",
                "redirect_uri": REDIRECT_URI,
                "code_challenge": "x",
            },
        )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_client"
        assert "location" not in response.headers

    async def test_unregistered_redirect_uri_is_never_redirected_to(self, client):
        response = await client.get(
            "/oauth2/authorize",
            params={
                "client_id": "dashboard",
                "redirect_uri": "http://evil.test/cb",
                "code_challenge": "x",
            },
        )

        assert response.status_code == 400
        assert "location" not in response.headers

    async def test_missing_pkce_is_rejected(self, client):
        _, challenge = pkce_pair()
        response = await start(client, challenge, code_challenge=None)

        assert response.status_code == 303
        assert query_of(response)["error"] == "invalid_request"

    async def test_plain_pkce_is_rejected(self, client):
        _, challenge = pkce_pair()
        response = await start(client, challenge, code_challenge_method="plain")

        assert query_of(response)["error"] == "invalid_request"

    async def test_unsupported_response_type_is_rejected(self, client):
        _, challenge = pkce_pair()
        response = await start(client, challenge, response_type="token")

        assert query_of(response)["error"] == "unsupported_response_type"

    async def test_protocol_errors_preserve_state(self, client):
        """Without state the client cannot match the error to its request."""
        _, challenge = pkce_pair()
        response = await start(client, challenge, code_challenge=None, state="s-42")

        assert query_of(response)["state"] == "s-42"


class TestLogin:
    async def test_cold_browser_is_sent_to_the_auth_ui(self, client):
        _, challenge = pkce_pair()
        response = await start(client, challenge)

        assert response.status_code == 303
        assert "/auth/login" in response.headers["location"]
        assert query_of(response)["challenge"]

    async def test_challenge_describes_the_request_for_the_ui(self, client):
        _, challenge = pkce_pair()
        challenge_id = query_of(await start(client, challenge))["challenge"]

        body = (await client.get(f"/api/v1/auth/challenge/{challenge_id}")).json()

        assert body["clientName"] == "IDEN Dashboard"
        assert {s["value"] for s in body["scopes"]} == set(DEFAULT_SCOPE.split())
        assert all(s["description"] for s in body["scopes"])

    async def test_expired_challenge_is_rejected(self, client):
        assert (
            await client.get("/api/v1/auth/challenge/not-a-challenge")
        ).status_code == 404

    async def test_password_login_records_pwd(self, client):
        _, challenge = pkce_pair()
        challenge_id = query_of(await start(client, challenge))["challenge"]

        body = (await sign_in(client, challenge_id)).json()

        assert body["status"] == "complete"
        assert body["amr"] == ["pwd"]
        assert body["acr"] == "iden:loa:1"

    async def test_session_cookie_is_httponly(self, client):
        _, challenge = pkce_pair()
        challenge_id = query_of(await start(client, challenge))["challenge"]

        response = await sign_in(client, challenge_id)

        assert "httponly" in response.headers["set-cookie"].lower()

    async def test_wrong_password_is_rejected(self, client):
        _, challenge = pkce_pair()
        challenge_id = query_of(await start(client, challenge))["challenge"]

        assert (
            await sign_in(client, challenge_id, password="wrong")
        ).status_code == 401

    async def test_unknown_email_is_rejected_the_same_way(self, client):
        """Same status and message as a wrong password — otherwise the endpoint
        enumerates which accounts exist."""
        _, challenge = pkce_pair()
        challenge_id = query_of(await start(client, challenge))["challenge"]

        wrong_user = await sign_in(client, challenge_id, email="nobody@test.local")
        wrong_password = await sign_in(client, challenge_id, password="wrong")

        assert wrong_user.status_code == wrong_password.status_code == 401
        assert wrong_user.json() == wrong_password.json()

    async def test_disabled_account_cannot_sign_in(self, client, db, admin_user):
        admin_user.is_active = False
        db.add(admin_user)
        await db.commit()

        _, challenge = pkce_pair()
        challenge_id = query_of(await start(client, challenge))["challenge"]

        assert (await sign_in(client, challenge_id)).status_code == 403


class TestStepUp:
    async def test_session_below_the_requested_acr_forces_a_step_up(self, client):
        _, challenge = pkce_pair()
        challenge_id = query_of(await start(client, challenge))["challenge"]
        await sign_in(client, challenge_id)

        response = await start(client, challenge, acr_values="iden:loa:2")

        assert "step_up=1" in response.headers["location"]

    async def test_login_reports_totp_required_when_acr_is_unmet(self, client):
        _, challenge = pkce_pair()
        response = await start(client, challenge, acr_values="iden:loa:2")
        challenge_id = query_of(response)["challenge"]

        body = (await sign_in(client, challenge_id)).json()

        assert body["status"] == "totp_required"
        assert body["resumeUrl"] is None

    async def test_met_acr_proceeds_normally(self, client):
        _, challenge = pkce_pair()
        response = await start(client, challenge, acr_values="iden:loa:1")
        challenge_id = query_of(response)["challenge"]

        assert (await sign_in(client, challenge_id)).json()["status"] == "complete"


class TestCodeIssuance:
    async def test_code_and_state_come_back_to_the_client(self, client):
        _, challenge = pkce_pair()
        challenge_id = query_of(await start(client, challenge))["challenge"]
        login = await sign_in(client, challenge_id)

        resumed = await client.get(login.json()["resumeUrl"])
        query = query_of(resumed)

        assert resumed.headers["location"].startswith(REDIRECT_URI)
        assert query["code"] and query["state"] == "xyz"

    async def test_code_is_not_stored_in_the_clear(self, client, db):
        from sqlalchemy import select

        from provider.shared.models import AuthorizationCode

        code, _ = await get_code(client)
        stored = (await db.scalars(select(AuthorizationCode))).all()

        assert len(stored) == 1
        assert stored[0].code_hash != code


class TestTokenExchange:
    async def test_returns_access_id_and_refresh_tokens(self, client):
        tokens = await get_tokens(client)

        assert tokens["token_type"] == "Bearer"
        assert tokens["access_token"] and tokens["id_token"] and tokens["refresh_token"]
        assert tokens["expires_in"] == 600

    async def test_access_token_is_audienced_to_the_apis_it_can_reach(self, client):
        claims = decode((await get_tokens(client))["access_token"])

        assert set(claims["aud"]) == {
            "http://localhost:8000/admin",
            "http://localhost:8000/entity",
        }

    async def test_access_token_carries_the_authentication_context(self, client):
        claims = decode((await get_tokens(client))["access_token"])

        assert claims["acr"] == "iden:loa:1"
        assert claims["amr"] == ["pwd"]
        assert claims["jti"] and claims["client_id"] == "dashboard"

    async def test_id_token_is_audienced_to_the_client_and_echoes_the_nonce(
        self, client
    ):
        claims = decode((await get_tokens(client))["id_token"])

        assert claims["aud"] == "dashboard"
        assert claims["nonce"] == "n-1"
        assert claims["auth_time"]

    async def test_id_token_releases_claims_by_scope(self, client):
        claims = decode((await get_tokens(client))["id_token"])

        assert claims["email"] == ADMIN_EMAIL
        assert claims["preferred_username"] == "admin"

    async def test_claims_are_withheld_when_their_scope_was_not_granted(self, client):
        claims = decode((await get_tokens(client, scope="openid"))["id_token"])

        assert "email" not in claims
        assert "preferred_username" not in claims

    async def test_no_id_token_without_openid(self, client):
        tokens = await get_tokens(client, scope="admin:users:read")
        assert tokens["id_token"] is None

    async def test_code_cannot_be_replayed(self, client):
        code, verifier = await get_code(client)
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": verifier,
            "client_id": "dashboard",
        }

        assert (await client.post("/oauth2/token", data=data)).status_code == 200
        replay = await client.post("/oauth2/token", data=data)

        assert replay.status_code == 400
        assert replay.json()["error"] == "invalid_grant"

    async def test_wrong_verifier_fails_pkce(self, client):
        code, _ = await get_code(client)
        response = await client.post(
            "/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": REDIRECT_URI,
                "code_verifier": "not-the-verifier",
                "client_id": "dashboard",
            },
        )

        assert response.status_code == 400
        assert "PKCE" in response.json()["error_description"]

    async def test_mismatched_redirect_uri_is_rejected(self, client):
        code, verifier = await get_code(client)
        response = await client.post(
            "/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": "http://localhost:5173/other",
                "code_verifier": verifier,
                "client_id": "dashboard",
            },
        )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_grant"
