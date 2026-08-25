import pytest

pytestmark = pytest.mark.usefixtures("admin_user", "dashboard")

WEB_APP = {
    "clientId": "library-web",
    "name": "Library",
    "clientType": "public",
    "allowedGrants": ["authorization_code", "refresh_token"],
    "redirectUris": ["https://library.example.org/callback"],
}
SERVICE = {
    "clientId": "nightly-job",
    "name": "Nightly Job",
    "clientType": "confidential",
    "allowedGrants": ["client_credentials"],
}


class TestRegistration:
    async def test_confidential_client_secret_is_shown_once(
        self, client, admin_headers
    ):
        created = (
            await client.post("/admin/clients", json=SERVICE, headers=admin_headers)
        ).json()
        assert created["clientSecret"]

        fetched = (
            await client.get(f"/admin/clients/{created['id']}", headers=admin_headers)
        ).json()
        assert "clientSecret" not in fetched

    async def test_public_client_gets_no_secret(self, client, admin_headers):
        """It has nowhere to keep one — PKCE is what proves it."""
        created = (
            await client.post("/admin/clients", json=WEB_APP, headers=admin_headers)
        ).json()
        assert created["clientSecret"] is None

    async def test_secret_is_not_stored_in_the_clear(self, client, admin_headers, db):
        from sqlalchemy import select

        from provider.shared.models import Client

        created = (
            await client.post("/admin/clients", json=SERVICE, headers=admin_headers)
        ).json()
        stored = await db.scalar(
            select(Client).where(Client.client_id == "nightly-job")
        )

        assert stored.client_secret_hash != created["clientSecret"]

    async def test_authorization_code_grant_requires_a_redirect_uri(
        self, client, admin_headers
    ):
        response = await client.post(
            "/admin/clients", json=WEB_APP | {"redirectUris": []}, headers=admin_headers
        )

        assert response.status_code == 422
        assert response.json()["code"] == "redirect_uri_required"

    async def test_relative_redirect_uri_is_rejected(self, client, admin_headers):
        response = await client.post(
            "/admin/clients",
            json=WEB_APP | {"redirectUris": ["/callback"]},
            headers=admin_headers,
        )
        assert response.status_code == 422

    async def test_duplicate_client_id_is_rejected(self, client, admin_headers):
        await client.post("/admin/clients", json=WEB_APP, headers=admin_headers)
        again = await client.post("/admin/clients", json=WEB_APP, headers=admin_headers)

        assert again.status_code == 409


class TestSecretRotation:
    async def test_rotation_invalidates_the_previous_secret(
        self, client, admin_headers, catalogue
    ):
        created = (
            await client.post("/admin/clients", json=SERVICE, headers=admin_headers)
        ).json()
        old_secret = created["clientSecret"]

        rotated = (
            await client.post(
                f"/admin/clients/{created['id']}/rotate-secret", headers=admin_headers
            )
        ).json()

        assert rotated["clientSecret"] != old_secret

        with_old = await client.post(
            "/oauth2/token",
            data={
                "grant_type": "client_credentials",
                "client_id": "nightly-job",
                "client_secret": old_secret,
            },
        )
        assert with_old.status_code == 401

        with_new = await client.post(
            "/oauth2/token",
            data={
                "grant_type": "client_credentials",
                "client_id": "nightly-job",
                "client_secret": rotated["clientSecret"],
            },
        )
        assert with_new.status_code == 200

    async def test_public_client_cannot_rotate(self, client, admin_headers):
        created = (
            await client.post("/admin/clients", json=WEB_APP, headers=admin_headers)
        ).json()
        response = await client.post(
            f"/admin/clients/{created['id']}/rotate-secret", headers=admin_headers
        )

        assert response.status_code == 422
        assert response.json()["code"] == "public_client_has_no_secret"


class TestClientScopes:
    async def test_grantable_and_granted_are_independent(
        self, client, admin_headers, catalogue
    ):
        created = (
            await client.post("/admin/clients", json=SERVICE, headers=admin_headers)
        ).json()
        read = str(catalogue["scopes"]["entity:profile:read"].id)
        write = str(catalogue["scopes"]["entity:profile:write"].id)

        body = (
            await client.put(
                f"/admin/clients/{created['id']}/scopes",
                json={"grantableScopeIds": [read], "grantedScopeIds": [write]},
                headers=admin_headers,
            )
        ).json()

        assert [s["value"] for s in body["grantableScopes"]] == ["entity:profile:read"]
        assert [s["value"] for s in body["grantedScopes"]] == ["entity:profile:write"]

    async def test_put_replaces_both_sets(self, client, admin_headers, catalogue):
        created = (
            await client.post("/admin/clients", json=SERVICE, headers=admin_headers)
        ).json()
        read = str(catalogue["scopes"]["entity:profile:read"].id)

        await client.put(
            f"/admin/clients/{created['id']}/scopes",
            json={"grantableScopeIds": [read], "grantedScopeIds": [read]},
            headers=admin_headers,
        )
        emptied = (
            await client.put(
                f"/admin/clients/{created['id']}/scopes",
                json={"grantableScopeIds": [], "grantedScopeIds": []},
                headers=admin_headers,
            )
        ).json()

        assert emptied["grantableScopes"] == [] and emptied["grantedScopes"] == []

    async def test_granted_scopes_reach_a_client_credentials_token(
        self, client, admin_headers, catalogue
    ):
        created = (
            await client.post("/admin/clients", json=SERVICE, headers=admin_headers)
        ).json()
        scope_id = str(catalogue["scopes"]["entity:profile:read"].id)

        await client.put(
            f"/admin/clients/{created['id']}/scopes",
            json={"grantableScopeIds": [], "grantedScopeIds": [scope_id]},
            headers=admin_headers,
        )

        token = (
            await client.post(
                "/oauth2/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": "nightly-job",
                    "client_secret": created["clientSecret"],
                    "scope": "entity:profile:read",
                },
            )
        ).json()

        assert token["scope"] == "entity:profile:read"


class TestProtection:
    async def test_bootstrap_client_cannot_be_deleted(
        self, client, admin_headers, db, dashboard
    ):
        dashboard.is_system = True
        db.add(dashboard)
        await db.commit()

        response = await client.delete(
            f"/admin/clients/{dashboard.id}", headers=admin_headers
        )

        assert response.status_code == 409
        assert response.json()["code"] == "system_client_immutable"

    async def test_read_scope_cannot_register_a_client(self, client, token_for):
        headers = await token_for("admin:clients:read")
        response = await client.post("/admin/clients", json=WEB_APP, headers=headers)
        assert response.status_code == 403
