import pytest

pytestmark = pytest.mark.usefixtures("admin_user", "dashboard")

API = {"name": "attendance", "audience": "https://api.example.org/attendance"}
SCOPE = {"value": "attendance:records:read", "description": "View attendance records."}


@pytest.fixture
async def api(client, admin_headers):
    return (await client.post("/admin/apis", json=API, headers=admin_headers)).json()


@pytest.fixture
async def scope(client, admin_headers, api):
    return (
        await client.post(
            f"/admin/apis/{api['id']}/scopes", json=SCOPE, headers=admin_headers
        )
    ).json()


class TestScopeDefinition:
    async def test_defines_a_scope_under_an_api(
        self, client, admin_headers, api, scope
    ):
        assert scope["value"] == SCOPE["value"]
        assert scope["apiName"] == "attendance"
        assert scope["audience"] == API["audience"]
        assert scope["isSystem"] is False

    async def test_scope_values_are_globally_unique(
        self, client, admin_headers, api, scope
    ):
        """A token carries scopes as bare strings and the audience is resolved
        from the value, so two APIs sharing one would blend their audiences."""
        other = (
            await client.post(
                "/admin/apis",
                json={"name": "library", "audience": "https://api.example.org/library"},
                headers=admin_headers,
            )
        ).json()

        collision = await client.post(
            f"/admin/apis/{other['id']}/scopes", json=SCOPE, headers=admin_headers
        )

        assert collision.status_code == 409
        assert collision.json()["code"] == "scope_value_taken"

    @pytest.mark.parametrize(
        "value",
        ["norealm", "Attendance:read", "attendance::read", "attendance:read:", ""],
    )
    async def test_value_must_be_a_namespaced_slug(
        self, client, admin_headers, api, value
    ):
        response = await client.post(
            f"/admin/apis/{api['id']}/scopes",
            json=SCOPE | {"value": value},
            headers=admin_headers,
        )
        assert response.status_code == 422

    async def test_description_is_required(self, client, admin_headers, api):
        """It is the sentence a user reads on the consent screen."""
        response = await client.post(
            f"/admin/apis/{api['id']}/scopes",
            json={"value": "attendance:records:write", "description": ""},
            headers=admin_headers,
        )
        assert response.status_code == 422

    async def test_appears_in_discovery_immediately(self, client, admin_headers, scope):
        body = (await client.get("/.well-known/openid-configuration")).json()
        assert SCOPE["value"] in body["scopes_supported"]

    async def test_system_scope_cannot_be_changed(
        self, client, admin_headers, catalogue
    ):
        system = catalogue["scopes"]["admin:users:read"]
        response = await client.patch(
            f"/admin/scopes/{system.id}",
            json={"description": "hijacked"},
            headers=admin_headers,
        )

        assert response.status_code == 409
        assert response.json()["code"] == "system_scope_immutable"

    async def test_system_scope_cannot_be_deleted(
        self, client, admin_headers, catalogue
    ):
        system = catalogue["scopes"]["admin:roles:write"]
        response = await client.delete(
            f"/admin/scopes/{system.id}", headers=admin_headers
        )
        assert response.status_code == 409

    async def test_unused_scope_deletes(self, client, admin_headers, scope):
        assert (
            await client.delete(f"/admin/scopes/{scope['id']}", headers=admin_headers)
        ).status_code == 204

    async def test_granted_scope_refuses_deletion(self, client, admin_headers, scope):
        await client.post(
            "/admin/roles",
            json={"name": "officer", "scopeIds": [scope["id"]]},
            headers=admin_headers,
        )
        response = await client.delete(
            f"/admin/scopes/{scope['id']}", headers=admin_headers
        )

        assert response.status_code == 409
        assert response.json()["code"] == "scope_in_use"


class TestRoles:
    async def test_creates_a_role_bundling_scopes(self, client, admin_headers, scope):
        response = await client.post(
            "/admin/roles",
            json={"name": "attendance-officer", "scopeIds": [scope["id"]]},
            headers=admin_headers,
        )
        body = response.json()

        assert response.status_code == 201
        assert [s["value"] for s in body["scopes"]] == [SCOPE["value"]]

    async def test_a_role_may_span_several_apis(
        self, client, admin_headers, scope, catalogue
    ):
        """A real job rarely stops at one system's boundary."""
        entity_scope = catalogue["scopes"]["entity:profile:read"]
        body = (
            await client.post(
                "/admin/roles",
                json={
                    "name": "officer",
                    "scopeIds": [scope["id"], str(entity_scope.id)],
                },
                headers=admin_headers,
            )
        ).json()

        assert {s["audience"] for s in body["scopes"]} == {
            API["audience"],
            "http://localhost:8000/entity",
        }

    async def test_unknown_scope_id_rejects_the_whole_request(
        self, client, admin_headers, scope
    ):
        """Partial application would leave the caller believing a role holds a
        scope it does not."""
        missing = "00000000-0000-0000-0000-000000000000"
        response = await client.post(
            "/admin/roles",
            json={"name": "officer", "scopeIds": [scope["id"], missing]},
            headers=admin_headers,
        )

        assert response.status_code == 404
        assert response.json()["details"]["missing"] == [missing]
        listing = (await client.get("/admin/roles", headers=admin_headers)).json()
        assert not [r for r in listing["items"] if r["name"] == "officer"]

    async def test_put_scopes_replaces_the_whole_set(
        self, client, admin_headers, scope, catalogue
    ):
        entity_scope = catalogue["scopes"]["entity:profile:read"]
        role = (
            await client.post(
                "/admin/roles",
                json={
                    "name": "officer",
                    "scopeIds": [scope["id"], str(entity_scope.id)],
                },
                headers=admin_headers,
            )
        ).json()

        updated = (
            await client.put(
                f"/admin/roles/{role['id']}/scopes",
                json={"scopeIds": [scope["id"]]},
                headers=admin_headers,
            )
        ).json()

        assert [s["value"] for s in updated["scopes"]] == [SCOPE["value"]]

    async def test_put_scopes_is_idempotent(self, client, admin_headers, scope):
        role = (
            await client.post(
                "/admin/roles", json={"name": "officer"}, headers=admin_headers
            )
        ).json()
        body = {"scopeIds": [scope["id"]]}

        first = (
            await client.put(
                f"/admin/roles/{role['id']}/scopes", json=body, headers=admin_headers
            )
        ).json()
        second = (
            await client.put(
                f"/admin/roles/{role['id']}/scopes", json=body, headers=admin_headers
            )
        ).json()

        assert first["scopes"] == second["scopes"]

    async def test_system_role_scopes_cannot_be_edited(
        self, client, admin_headers, catalogue, scope
    ):
        administrator = catalogue["roles"]["administrator"]
        response = await client.put(
            f"/admin/roles/{administrator.id}/scopes",
            json={"scopeIds": [scope["id"]]},
            headers=admin_headers,
        )

        assert response.status_code == 409

    async def test_assigned_role_refuses_deletion(self, client, admin_headers, member):
        role = (
            await client.post(
                "/admin/roles", json={"name": "officer"}, headers=admin_headers
            )
        ).json()
        # Assigned to an ordinary member, not the administrator: replacing the
        # only administrator's roles is refused outright — see the lockout guard.
        await client.put(
            f"/admin/users/{member.id}/roles",
            json={"roleIds": [role["id"]]},
            headers=admin_headers,
        )

        response = await client.delete(
            f"/admin/roles/{role['id']}", headers=admin_headers
        )
        assert response.status_code == 409
        assert response.json()["code"] == "role_in_use"

    async def test_force_deletes_an_assigned_role(
        self, client, admin_headers, admin_user
    ):
        role = (
            await client.post(
                "/admin/roles", json={"name": "officer"}, headers=admin_headers
            )
        ).json()
        await client.put(
            f"/admin/users/{admin_user.id}/roles",
            json={"roleIds": [role["id"]]},
            headers=admin_headers,
        )

        response = await client.delete(
            f"/admin/roles/{role['id']}?force=true", headers=admin_headers
        )
        assert response.status_code == 204

    async def test_write_scope_is_required(self, client, token_for):
        headers = await token_for("admin:roles:read")
        response = await client.post(
            "/admin/roles", json={"name": "x"}, headers=headers
        )
        assert response.status_code == 403
