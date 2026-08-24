"""The scope resolver is pure logic over loaded objects, so these tests build
the object graph in memory — no database, no fixtures, no I/O."""

import pytest

from provider.authz.services.scope_resolver import (
    effective_user_scopes,
    format_scope,
    grantable_scopes,
    granted_scopes,
    parse_scope,
    resolve_for_client,
    resolve_for_user,
    scope_provenance,
)
from provider.shared.models import Client, ClientScope, Group, Role, Scope, User


def scope(value: str) -> Scope:
    return Scope(value=value, description=value)


def role(name: str, *values: str) -> Role:
    instance = Role(name=name)
    instance.scopes = [scope(v) for v in values]
    return instance


def user(*, roles=(), groups=(), direct=()) -> User:
    instance = User(email="a@b.c", username="ab", password_hash="x")
    instance.roles = list(roles)
    instance.groups = list(groups)
    instance.scopes = [scope(v) for v in direct]
    return instance


def group(name: str, *roles_) -> Group:
    instance = Group(name=name)
    instance.roles = list(roles_)
    return instance


def client(*, grantable=(), granted=()) -> Client:
    instance = Client(client_id="c", name="C", client_type="public")
    links = []
    for value in grantable:
        links.append(ClientScope(grantable=True, granted=False, scope=scope(value)))
    for value in granted:
        links.append(ClientScope(grantable=False, granted=True, scope=scope(value)))
    instance.scopes = links
    return instance


class TestEffectiveScopes:
    def test_direct_grants_are_included(self):
        assert effective_user_scopes(user(direct=["a:read"])) == {"a:read"}

    def test_direct_roles_are_included(self):
        assert effective_user_scopes(user(roles=[role("r", "a:read")])) == {"a:read"}

    def test_roles_are_inherited_from_groups(self):
        staff = group("staff", role("officer", "a:write"))
        assert effective_user_scopes(user(groups=[staff])) == {"a:write"}

    def test_all_three_sources_are_unioned(self):
        staff = group("staff", role("officer", "c:read"))
        subject = user(roles=[role("r", "b:read")], groups=[staff], direct=["a:read"])
        assert effective_user_scopes(subject) == {"a:read", "b:read", "c:read"}

    def test_overlapping_sources_do_not_duplicate(self):
        shared = role("shared", "a:read")
        staff = group("staff", shared)
        assert effective_user_scopes(user(roles=[shared], groups=[staff])) == {"a:read"}

    def test_a_user_with_nothing_has_nothing(self):
        assert effective_user_scopes(user()) == set()


class TestProvenance:
    def test_each_source_is_reported(self):
        staff = group("staff", role("officer", "c:read"))
        subject = user(roles=[role("r", "b:read")], groups=[staff], direct=["a:read"])
        by_value = {s.value: s for s in scope_provenance(subject)}

        assert by_value["a:read"].via_direct
        assert by_value["b:read"].via_roles == ["r"]
        assert by_value["c:read"].via_groups == ["staff → officer"]

    def test_one_scope_can_have_several_sources(self):
        shared = role("shared", "a:read")
        staff = group("staff", shared)
        subject = user(roles=[shared], groups=[staff], direct=["a:read"])

        entry = scope_provenance(subject)[0]
        assert entry.via_direct and entry.via_roles == ["shared"] and entry.via_groups


class TestAuthorizationCodeResolution:
    def test_intersection_of_requested_client_and_user(self):
        subject = user(roles=[role("r", "a:read", "b:read")])
        app = client(grantable=["a:read", "b:read", "c:read"])

        granted = resolve_for_user({"a:read", "c:read"}, app, subject)
        assert granted == {"a:read"}

    def test_pruning_is_silent_not_an_error(self):
        """An over-broad request yields a narrower token — this is what lets the
        dashboard ask for everything and still work for a non-admin."""
        subject = user(roles=[role("r", "a:read")])
        app = client(grantable=["a:read", "admin:users:write"])

        assert resolve_for_user({"a:read", "admin:users:write"}, app, subject) == {"a:read"}

    def test_a_scope_the_client_may_not_request_is_dropped(self):
        subject = user(roles=[role("r", "a:read", "b:read")])
        app = client(grantable=["a:read"])

        assert resolve_for_user({"a:read", "b:read"}, app, subject) == {"a:read"}

    @pytest.mark.parametrize("oidc", ["openid", "profile", "email"])
    def test_oidc_scopes_bypass_the_catalogue(self, oidc):
        """They are not permissions on any API, so they are neither stored nor
        gated — they only decide which claims are released."""
        assert resolve_for_user({oidc}, client(), user()) == {oidc}

    def test_unknown_scopes_are_dropped(self):
        assert resolve_for_user({"made:up"}, client(), user()) == set()


class TestClientCredentialsResolution:
    def test_intersection_with_what_the_client_holds(self):
        app = client(granted=["a:read", "b:read"])
        assert resolve_for_client({"a:read", "c:read"}, app) == {"a:read"}

    def test_grantable_scopes_are_not_held_by_the_client_itself(self):
        """Being allowed to ask on a user's behalf is not the same as holding it."""
        app = client(grantable=["a:read"])
        assert resolve_for_client({"a:read"}, app) == set()

    def test_oidc_scopes_are_not_granted(self):
        """There is no person for /userinfo to describe."""
        app = client(granted=["a:read"])
        assert resolve_for_client({"openid", "a:read"}, app) == {"a:read"}


class TestClientScopeSets:
    def test_the_two_lists_are_independent(self):
        app = client(grantable=["a:read"], granted=["b:read"])
        assert grantable_scopes(app) == {"a:read"}
        assert granted_scopes(app) == {"b:read"}


class TestScopeStrings:
    def test_parse_splits_on_whitespace(self):
        assert parse_scope("a  b\tc") == {"a", "b", "c"}

    @pytest.mark.parametrize("empty", [None, "", "   "])
    def test_parse_handles_empty(self, empty):
        assert parse_scope(empty) == set()

    def test_format_is_sorted_for_determinism(self):
        assert format_scope({"c", "a", "b"}) == "a b c"
