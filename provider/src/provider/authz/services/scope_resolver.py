"""Effective scopes, and what actually lands in a token.

Pure synchronous set logic over already-loaded ORM objects — no I/O, no
framework. That is why the same implementation serves token issuance, the admin
provenance endpoint, and entity self-service.
"""

from dataclasses import dataclass, field

from provider.shared.models import Client, ClientScope, Role, User

# OIDC's own scopes (OpenID Connect Core §5.4, §11). They are not permissions on
# any API, so they are never stored in the scopes table and never contribute an
# audience — they decide which claims are released, and in `offline_access`'s
# case whether a refresh token is issued at all.
OIDC_SCOPES = frozenset({"openid", "profile", "email", "offline_access"})

# Requesting long-lived access to your account while you are away from it.
# Separate from the grant the client is configured for: the client says what it
# is *able* to do, this says what was asked for and consented to on this
# request (OIDC Core §11).
OFFLINE_ACCESS = "offline_access"


@dataclass
class ScopeSource:
    """Where one scope came from — the answer to 'why can this person do that?'"""

    value: str
    via_direct: bool = False
    via_roles: list[str] = field(default_factory=list)
    via_groups: list[str] = field(default_factory=list)


def _role_scope_values(role: Role) -> set[str]:
    return {scope.value for scope in role.scopes}


def effective_user_scopes(user: User) -> set[str]:
    """Direct grants ∪ scopes of direct roles ∪ scopes of roles held by the
    user's groups."""
    values = {scope.value for scope in user.scopes}

    for role in user.roles:
        values |= _role_scope_values(role)

    for group in user.groups:
        for role in group.roles:
            values |= _role_scope_values(role)

    return values


def scope_provenance(user: User) -> list[ScopeSource]:
    """The same union, annotated with its origin. Powers
    `GET /admin/users/{id}/effective-scopes` and `GET /entity/permissions`."""
    sources: dict[str, ScopeSource] = {}

    def source(value: str) -> ScopeSource:
        return sources.setdefault(value, ScopeSource(value=value))

    for scope in user.scopes:
        source(scope.value).via_direct = True

    for role in user.roles:
        for value in _role_scope_values(role):
            source(value).via_roles.append(role.name)

    for group in user.groups:
        for role in group.roles:
            for value in _role_scope_values(role):
                source(value).via_groups.append(f"{group.name} → {role.name}")

    return [sources[value] for value in sorted(sources)]


def _client_scopes(client: Client, attribute: str) -> set[str]:
    links: list[ClientScope] = client.scopes
    return {link.scope.value for link in links if getattr(link, attribute)}


def grantable_scopes(client: Client) -> set[str]:
    """Scopes this client may request on behalf of a user."""
    return _client_scopes(client, "grantable")


def granted_scopes(client: Client) -> set[str]:
    """Scopes the client holds in its own right, for client_credentials."""
    return _client_scopes(client, "granted")


def parse_scope(raw: str | None) -> set[str]:
    """OAuth scope is a space-delimited string — RFC 6749 §3.3."""
    return set(raw.split()) if raw else set()


def format_scope(values: set[str]) -> str:
    return " ".join(sorted(values))


def resolve_for_user(requested: set[str], client: Client, user: User) -> set[str]:
    """granted = requested ∩ client.grantable ∩ effective_user_scopes.

    Pruning is silent by design: asking for more than you hold yields a narrower
    token, not an error. That is what lets the dashboard request a broad set at
    /authorize and still work for a non-admin user.
    """
    permissions = requested & grantable_scopes(client) & effective_user_scopes(user)
    return permissions | (requested & OIDC_SCOPES)


def resolve_for_client(requested: set[str], client: Client) -> set[str]:
    """granted = requested ∩ client.granted. No user, so no OIDC scopes —
    there is no person for /userinfo to describe."""
    return requested & granted_scopes(client)
