"""The system API, scope, and role catalogue seeded by `scripts.seed`.

Everything here is flagged `is_system` in the database and cannot be renamed or
deleted through the admin API — without that guard an administrator could
delete `admin:roles:write` and lock the organization out of its own deployment.

Admin-created APIs, scopes, and roles carry no such flag and are fully mutable.
When a new admin resource ships, add its scopes here and re-run the seed.
"""

from dataclasses import dataclass

from provider.core.config import settings


@dataclass(frozen=True)
class ScopeSpec:
    value: str
    description: str


@dataclass(frozen=True)
class ApiSpec:
    name: str
    audience: str
    description: str
    scopes: tuple[ScopeSpec, ...]


@dataclass(frozen=True)
class RoleSpec:
    name: str
    description: str
    scopes: tuple[str, ...]


ADMIN_SCOPES = (
    ScopeSpec("admin:users:read", "View users, their roles, and their direct grants."),
    ScopeSpec(
        "admin:users:write", "Create, update, and delete users and their grants."
    ),
    ScopeSpec("admin:groups:read", "View groups, their members, and their roles."),
    ScopeSpec(
        "admin:groups:write", "Create, update, and delete groups and membership."
    ),
    ScopeSpec("admin:roles:read", "View roles and the scopes they bundle."),
    ScopeSpec(
        "admin:roles:write", "Create, update, and delete roles and their scopes."
    ),
    ScopeSpec("admin:apis:read", "View registered resource APIs."),
    ScopeSpec("admin:apis:write", "Register, update, and delete resource APIs."),
    ScopeSpec("admin:scopes:read", "View the scopes defined under an API."),
    ScopeSpec("admin:scopes:write", "Define, update, and delete scopes under an API."),
    ScopeSpec("admin:clients:read", "View registered OAuth clients."),
    ScopeSpec("admin:clients:write", "Register clients and rotate their secrets."),
    # Read-only by design: the audit log is written by the requests it records
    # and has no write endpoint to grant.
    ScopeSpec("admin:audit:read", "Read the audit log."),
)

ENTITY_SCOPES = (
    ScopeSpec("entity:profile:read", "View your own profile."),
    ScopeSpec("entity:profile:write", "Update your own profile."),
    ScopeSpec("entity:credentials:write", "Change your own password."),
    ScopeSpec("entity:totp:read", "View the status of your authenticator app."),
    ScopeSpec("entity:totp:enroll", "Set up or remove your authenticator app."),
    ScopeSpec("entity:sessions:read", "See where you are signed in."),
    ScopeSpec("entity:sessions:revoke", "Sign yourself out of other sessions."),
    ScopeSpec(
        "entity:permissions:read", "See your own roles, groups, and permissions."
    ),
)

BIOMETRIC_SCOPES = (
    ScopeSpec("biometric:enroll", "Enrol a face template."),
    ScopeSpec("biometric:verify", "Verify a face against a claimed identity."),
    ScopeSpec("biometric:search", "Identify a face against all enrolled templates."),
    ScopeSpec("biometric:liveness", "Check whether a captured face is live."),
)


def system_apis() -> tuple[ApiSpec, ...]:
    apis = (
        ApiSpec(
            name="admin",
            audience=settings.admin_audience,
            description="IDEN administration — users, groups, roles, APIs, scopes, clients.",
            scopes=ADMIN_SCOPES,
        ),
        ApiSpec(
            name="entity",
            audience=settings.entity_audience,
            description="Self-service for the signed-in person.",
            scopes=ENTITY_SCOPES,
        ),
    )
    if settings.iden_biometric_enabled:
        apis += (
            ApiSpec(
                name="biometric",
                audience=settings.biometric_audience,
                description="Facial enrollment and verification.",
                scopes=BIOMETRIC_SCOPES,
            ),
        )
    return apis


def system_roles() -> tuple[RoleSpec, ...]:
    admin = tuple(s.value for s in ADMIN_SCOPES)
    entity = tuple(s.value for s in ENTITY_SCOPES)
    return (
        RoleSpec(
            name="administrator",
            description="Full control over the deployment.",
            scopes=admin + entity,
        ),
        RoleSpec(
            name="member",
            description="An ordinary person with self-service access only.",
            scopes=entity,
        ),
    )
