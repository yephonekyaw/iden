import pytest

pytestmark = pytest.mark.usefixtures("admin_user", "dashboard")

NEW_USER = {"email": "student@test.local", "username": "student", "displayName": "A Student"}


@pytest.fixture
async def user(client, admin_headers):
    return (await client.post("/admin/users", json=NEW_USER, headers=admin_headers)).json()


@pytest.fixture
async def group(client, admin_headers):
    return (await client.post(
        "/admin/groups", json={"name": "Students"}, headers=admin_headers
    )).json()


class TestUserCreation:
    async def test_generates_a_password_and_shows_it_once(self, client, admin_headers, user):
        assert user["generatedPassword"]

        fetched = (await client.get(f"/admin/users/{user['id']}", headers=admin_headers)).json()
        assert "generatedPassword" not in fetched

    async def test_supplied_password_is_not_echoed(self, client, admin_headers):
        body = (await client.post(
            "/admin/users",
            json=NEW_USER | {"email": "b@test.local", "username": "b", "password": "a-long-password"},
            headers=admin_headers,
        )).json()

        assert body["generatedPassword"] is None

    async def test_short_password_is_rejected(self, client, admin_headers):
        response = await client.post(
            "/admin/users",
            json=NEW_USER | {"email": "c@test.local", "username": "c", "password": "short"},
            headers=admin_headers,
        )
        assert response.status_code == 422

    async def test_duplicate_email_is_rejected(self, client, admin_headers, user):
        response = await client.post(
            "/admin/users", json=NEW_USER | {"username": "other"}, headers=admin_headers
        )
        assert response.status_code == 409
        assert response.json()["code"] == "email_taken"

    async def test_duplicate_username_is_rejected(self, client, admin_headers, user):
        response = await client.post(
            "/admin/users", json=NEW_USER | {"email": "other@test.local"}, headers=admin_headers
        )
        assert response.json()["code"] == "username_taken"

    async def test_invalid_email_is_rejected(self, client, admin_headers):
        response = await client.post(
            "/admin/users", json=NEW_USER | {"email": "not-an-email"}, headers=admin_headers
        )
        assert response.status_code == 422


class TestUserFiltering:
    async def test_filters_by_group(self, client, admin_headers, user, group):
        await client.post(
            f"/admin/groups/{group['id']}/members",
            json={"userIds": [user["id"]]},
            headers=admin_headers,
        )

        body = (await client.get(
            f"/admin/users?groupId={group['id']}", headers=admin_headers
        )).json()

        assert [u["email"] for u in body["items"]] == [NEW_USER["email"]]

    async def test_filters_by_active_status(self, client, admin_headers, user):
        await client.patch(
            f"/admin/users/{user['id']}", json={"isActive": False}, headers=admin_headers
        )

        inactive = (await client.get("/admin/users?isActive=false", headers=admin_headers)).json()
        assert [u["email"] for u in inactive["items"]] == [NEW_USER["email"]]

    async def test_searches_email_and_username(self, client, admin_headers, user):
        body = (await client.get("/admin/users?search=STUD", headers=admin_headers)).json()
        assert len(body["items"]) == 1


class TestDeactivation:
    async def test_deactivated_user_cannot_refresh(self, client, admin_headers, db):
        """Deactivation has to reach live credentials, or the account stays
        usable until they expire on their own."""
        from tests.flows import get_tokens

        tokens = await get_tokens(client)
        me = (await client.get("/admin/users?search=admin@test", headers=admin_headers)).json()
        user_id = me["items"][0]["id"]

        await client.patch(f"/admin/users/{user_id}", json={"isActive": False}, headers=admin_headers)

        refreshed = await client.post(
            "/oauth2/token",
            data={"grant_type": "refresh_token", "refresh_token": tokens["refresh_token"],
                  "client_id": "dashboard"},
        )
        assert refreshed.status_code == 400


class TestPasswordReset:
    async def test_generates_a_password_and_revokes_tokens(self, client, admin_headers, user):
        from tests.flows import get_tokens

        tokens = await get_tokens(client)
        me = (await client.get("/admin/users?search=admin@test", headers=admin_headers)).json()

        response = await client.post(
            f"/admin/users/{me['items'][0]['id']}/reset-password", json={}, headers=admin_headers
        )
        body = response.json()

        assert body["password"] and body["sessionsRevoked"] is True

        refreshed = await client.post(
            "/oauth2/token",
            data={"grant_type": "refresh_token", "refresh_token": tokens["refresh_token"],
                  "client_id": "dashboard"},
        )
        assert refreshed.status_code == 400


class TestGroups:
    async def test_membership_is_idempotent(self, client, admin_headers, user, group):
        body = {"userIds": [user["id"]]}
        await client.post(f"/admin/groups/{group['id']}/members", json=body, headers=admin_headers)
        second = await client.post(
            f"/admin/groups/{group['id']}/members", json=body, headers=admin_headers
        )

        assert second.status_code == 204
        members = (await client.get(
            f"/admin/groups/{group['id']}/members", headers=admin_headers
        )).json()
        assert members["meta"]["total"] == 1

    async def test_unknown_user_rejects_the_whole_request(self, client, admin_headers, group, user):
        missing = "00000000-0000-0000-0000-000000000000"
        response = await client.post(
            f"/admin/groups/{group['id']}/members",
            json={"userIds": [user["id"], missing]},
            headers=admin_headers,
        )

        assert response.status_code == 404
        members = (await client.get(
            f"/admin/groups/{group['id']}/members", headers=admin_headers
        )).json()
        assert members["meta"]["total"] == 0

    async def test_removing_a_member_leaves_the_user(self, client, admin_headers, user, group):
        await client.post(
            f"/admin/groups/{group['id']}/members",
            json={"userIds": [user["id"]]},
            headers=admin_headers,
        )

        await client.delete(
            f"/admin/groups/{group['id']}/members/{user['id']}", headers=admin_headers
        )

        assert (await client.get(f"/admin/users/{user['id']}", headers=admin_headers)).status_code == 200

    async def test_deleting_a_group_does_not_delete_its_users(self, client, admin_headers, user, group):
        await client.post(
            f"/admin/groups/{group['id']}/members",
            json={"userIds": [user["id"]]},
            headers=admin_headers,
        )

        await client.delete(f"/admin/groups/{group['id']}", headers=admin_headers)

        assert (await client.get(f"/admin/users/{user['id']}", headers=admin_headers)).status_code == 200


class TestEffectiveScopes:
    async def test_reports_a_directly_assigned_role(self, client, admin_headers, user, catalogue):
        role = (await client.post(
            "/admin/roles",
            json={"name": "reader", "scopeIds": [str(catalogue["scopes"]["entity:profile:read"].id)]},
            headers=admin_headers,
        )).json()
        await client.put(
            f"/admin/users/{user['id']}/roles", json={"roleIds": [role["id"]]}, headers=admin_headers
        )

        body = (await client.get(
            f"/admin/users/{user['id']}/effective-scopes", headers=admin_headers
        )).json()
        entry = next(s for s in body["scopes"] if s["value"] == "entity:profile:read")

        assert entry["viaRoles"] == ["reader"]
        assert entry["viaDirect"] is False

    async def test_reports_the_group_and_role_a_scope_came_through(
        self, client, admin_headers, user, group, catalogue
    ):
        role = (await client.post(
            "/admin/roles",
            json={"name": "reader", "scopeIds": [str(catalogue["scopes"]["entity:profile:read"].id)]},
            headers=admin_headers,
        )).json()
        await client.put(
            f"/admin/groups/{group['id']}/roles", json={"roleIds": [role["id"]]}, headers=admin_headers
        )
        await client.post(
            f"/admin/groups/{group['id']}/members",
            json={"userIds": [user["id"]]},
            headers=admin_headers,
        )

        body = (await client.get(
            f"/admin/users/{user['id']}/effective-scopes", headers=admin_headers
        )).json()
        entry = next(s for s in body["scopes"] if s["value"] == "entity:profile:read")

        assert entry["viaGroups"] == ["Students → reader"]

    async def test_reports_a_direct_grant(self, client, admin_headers, user, catalogue):
        scope_id = str(catalogue["scopes"]["entity:totp:enroll"].id)
        await client.put(
            f"/admin/users/{user['id']}/scopes", json={"scopeIds": [scope_id]}, headers=admin_headers
        )

        body = (await client.get(
            f"/admin/users/{user['id']}/effective-scopes", headers=admin_headers
        )).json()
        entry = next(s for s in body["scopes"] if s["value"] == "entity:totp:enroll")

        assert entry["viaDirect"] is True

    async def test_a_new_user_holds_nothing(self, client, admin_headers, user):
        body = (await client.get(
            f"/admin/users/{user['id']}/effective-scopes", headers=admin_headers
        )).json()
        assert body["scopes"] == []
