"""Phase 4.1 — the profile schema an organization defines for itself.

The feature that lets a university and a company run the same IdP without
either of them forking it.
"""

import pytest

from provider.core.security import hash_secret
from provider.shared.models import Group, User

pytestmark = pytest.mark.usefixtures("admin_user", "dashboard")

STUDENT_ID = {
    "key": "student_id",
    "label": "Student number",
    "dataType": "string",
    "unique": True,
    "userWritable": False,
    "validators": {"pattern": "^[0-9]{8}$"},
}
PREFERRED_NAME = {
    "key": "preferred_name",
    "label": "Preferred name",
    "userWritable": True,
}


@pytest.fixture
async def member(db, catalogue) -> User:
    """An ordinary person: every entity scope, no admin authority."""
    user = User(
        email="student@test.local",
        username="student",
        display_name="A Student",
        password_hash=hash_secret("correct-horse-battery-staple"),
    )
    user.roles = [catalogue["roles"]["member"]]
    db.add(user)
    await db.commit()
    return user


@pytest.fixture
async def entity_headers(token_for, member, catalogue):
    return await token_for(
        *[v for v in catalogue["scopes"] if v.startswith("entity:")], user=member
    )


async def define(client, admin_headers, body: dict):
    response = await client.post(
        "/admin/profile-fields", json=body, headers=admin_headers
    )
    assert response.status_code == 201, response.text
    return response.json()


class TestDefiningFields:
    async def test_requires_its_own_scope(self, client, token_for):
        headers = await token_for("admin:users:write")
        response = await client.post(
            "/admin/profile-fields", json=STUDENT_ID, headers=headers
        )
        assert response.status_code == 403

    async def test_a_key_cannot_be_reused(self, client, admin_headers):
        await define(client, admin_headers, STUDENT_ID)
        again = await client.post(
            "/admin/profile-fields", json=STUDENT_ID, headers=admin_headers
        )
        assert again.status_code == 409

    async def test_an_enum_needs_options(self, client, admin_headers):
        response = await client.post(
            "/admin/profile-fields",
            json={"key": "campus", "label": "Campus", "dataType": "enum"},
            headers=admin_headers,
        )
        assert response.status_code == 422

    async def test_a_claim_cannot_shadow_a_reserved_one(self, client, admin_headers):
        """A custom field named `sub` would let an administrator forge the
        meaning of a token."""
        response = await client.post(
            "/admin/profile-fields",
            json={
                "key": "impostor",
                "label": "Impostor",
                "claimName": "sub",
                "claimScope": "entity:profile:read",
            },
            headers=admin_headers,
        )
        assert response.status_code == 422

    async def test_a_claim_needs_a_scope_to_be_released_under(
        self, client, admin_headers
    ):
        response = await client.post(
            "/admin/profile-fields",
            json={"key": "dept", "label": "Department", "claimName": "department"},
            headers=admin_headers,
        )
        assert response.status_code == 422


class TestSelfService:
    async def test_a_writable_field_is_the_persons_own(
        self, client, admin_headers, entity_headers
    ):
        await define(client, admin_headers, PREFERRED_NAME)

        response = await client.patch(
            "/entity/profile",
            json={"fields": {"preferred_name": "Sam"}},
            headers=entity_headers,
        )

        assert response.status_code == 200
        assert response.json()["fields"]["preferred_name"] == "Sam"

    async def test_a_read_only_field_is_refused(
        self, client, admin_headers, entity_headers
    ):
        """The rule the whole module turns on: a person may change anything
        about themselves that does not change what they are allowed to do, and
        `student_id` is the registrar's, not theirs."""
        await define(client, admin_headers, STUDENT_ID)

        response = await client.patch(
            "/entity/profile",
            json={"fields": {"student_id": "00000001"}},
            headers=entity_headers,
        )

        assert response.status_code == 422
        assert response.json()["code"] == "field_not_writable"

    async def test_an_unknown_field_is_refused_not_ignored(
        self, client, entity_headers
    ):
        """Silently dropping it would let a client believe it saved something."""
        response = await client.patch(
            "/entity/profile",
            json={"fields": {"invented": "x"}},
            headers=entity_headers,
        )
        assert response.status_code == 404

    async def test_the_admin_can_write_what_the_person_cannot(
        self, client, admin_headers, entity_headers, member
    ):
        await define(client, admin_headers, STUDENT_ID)

        written = await client.patch(
            f"/admin/users/{member.id}/profile",
            json={"fields": {"student_id": "12345678"}},
            headers=admin_headers,
        )
        assert written.status_code == 200

        seen = await client.get("/entity/profile", headers=entity_headers)
        assert seen.json()["fields"]["student_id"] == "12345678"


class TestValidation:
    async def test_a_value_must_match_the_pattern(self, client, admin_headers, member):
        await define(client, admin_headers, STUDENT_ID)

        response = await client.patch(
            f"/admin/users/{member.id}/profile",
            json={"fields": {"student_id": "nope"}},
            headers=admin_headers,
        )

        assert response.status_code == 422
        assert response.json()["details"]["field"] == "student_id"

    async def test_an_integer_field_rejects_words(self, client, admin_headers, member):
        await define(
            client,
            admin_headers,
            {"key": "year", "label": "Year", "dataType": "integer"},
        )

        response = await client.patch(
            f"/admin/users/{member.id}/profile",
            json={"fields": {"year": "first"}},
            headers=admin_headers,
        )
        assert response.status_code == 422

    async def test_an_enum_rejects_values_outside_its_options(
        self, client, admin_headers, member
    ):
        await define(
            client,
            admin_headers,
            {
                "key": "campus",
                "label": "Campus",
                "dataType": "enum",
                "options": ["north", "south"],
            },
        )

        response = await client.patch(
            f"/admin/users/{member.id}/profile",
            json={"fields": {"campus": "east"}},
            headers=admin_headers,
        )
        assert response.status_code == 422

    async def test_a_unique_field_cannot_collide(
        self, client, admin_headers, member, admin_user
    ):
        """Enforced by the database, because a check-then-write in the service
        layer races — and two students sharing a number is exactly the failure
        that must not happen."""
        await define(client, admin_headers, STUDENT_ID)

        first = await client.patch(
            f"/admin/users/{member.id}/profile",
            json={"fields": {"student_id": "12345678"}},
            headers=admin_headers,
        )
        second = await client.patch(
            f"/admin/users/{admin_user.id}/profile",
            json={"fields": {"student_id": "12345678"}},
            headers=admin_headers,
        )

        assert first.status_code == 200
        assert second.status_code == 409


class TestGroupBoundFields:
    async def test_a_field_bound_to_a_group_reaches_only_its_members(
        self, client, admin_headers, entity_headers, db, member
    ):
        """How students and staff get different forms without a second
        grouping concept."""
        students = Group(name="Students")
        db.add(students)
        await db.commit()

        await define(
            client,
            admin_headers,
            {**STUDENT_ID, "groupId": str(students.id), "userWritable": True},
        )

        before = await client.get("/entity/profile/schema", headers=entity_headers)
        assert [f["key"] for f in before.json()["fields"]] == []

        # Refreshed first: `groups` was never loaded on this instance, and
        # assigning to an unloaded collection triggers a lazy load in async
        # code. See provider/README.md § Loading relationships on new objects.
        await db.refresh(member, ["groups"])
        member.groups = [students]
        await db.commit()

        after = await client.get("/entity/profile/schema", headers=entity_headers)
        assert [f["key"] for f in after.json()["fields"]] == ["student_id"]


class TestSchemaEndpoint:
    async def test_describes_the_form_to_render(
        self, client, admin_headers, entity_headers
    ):
        await define(client, admin_headers, STUDENT_ID)
        await define(client, admin_headers, PREFERRED_NAME)

        body = (
            await client.get("/entity/profile/schema", headers=entity_headers)
        ).json()

        by_key = {field["key"]: field for field in body["fields"]}
        assert by_key["student_id"]["writable"] is False
        assert by_key["preferred_name"]["writable"] is True
        assert by_key["student_id"]["validators"] == {"pattern": "^[0-9]{8}$"}
