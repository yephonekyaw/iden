"""The response headers every route sends, whoever wrote the route."""

from provider.core import headers as headers_module


class TestSecurityHeaders:
    async def test_every_response_carries_them(self, client, catalogue):
        response = await client.get("/health")

        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["referrer-policy"] == "no-referrer"
        assert "frame-ancestors 'none'" in response.headers["content-security-policy"]

    async def test_an_error_response_carries_them_too(self, client, catalogue):
        """The headers ride on the response the middleware stack produces, not
        on the ones routes happen to return."""
        response = await client.get("/admin/users")

        assert response.status_code == 401
        assert response.headers["x-content-type-options"] == "nosniff"

    async def test_a_token_response_is_never_stored(self, client, kiosk, catalogue):
        """RFC 6749 Section 5.1 — a cached token response is a token in a proxy."""
        client_row, secret = kiosk
        response = await client.post(
            "/oauth2/token",
            data={
                "grant_type": "client_credentials",
                "client_id": client_row.client_id,
                "client_secret": secret,
                "scope": "biometric:verify",
            },
        )

        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["pragma"] == "no-cache"

    async def test_discovery_stays_cacheable(self, client, catalogue):
        """Every resource server fetches the key set; making it uncacheable
        would put IDEN in the path of every token validation."""
        response = await client.get("/.well-known/jwks.json")

        assert response.headers["cache-control"] == "public, max-age=300"
        assert "pragma" not in response.headers

    async def test_the_docs_may_load_their_assets(self, client):
        """`default-src 'none'` on /docs renders a blank page."""
        response = await client.get("/docs")

        assert "default-src" not in response.headers["content-security-policy"]
        assert "frame-ancestors 'none'" in response.headers["content-security-policy"]

    async def test_hsts_only_in_production(self, client, catalogue, monkeypatch):
        """Sent from http://localhost it pins every other project on localhost
        to HTTPS in the developer's browser."""
        assert "strict-transport-security" not in (await client.get("/health")).headers

        monkeypatch.setattr(headers_module.settings, "iden_env", "prod")
        response = await client.get("/health")
        assert "max-age=31536000" in response.headers["strict-transport-security"]
