"""Canonical scope definitions.

Single source of truth for the ``scopes`` table. The seed script upserts
from ``ADMIN_SCOPES``; routes import the name constants to declare what
scope each endpoint requires.
"""

from dataclasses import dataclass

from shared.roles import ROLE_ADMIN, Role


@dataclass(frozen=True)
class ScopeDef:
    name: str
    description: str
    resource: str  # admin | entity | biometric
    allowed_roles: tuple[Role, ...]


# Name constants — reference these from routes so scope names can't drift.
ADMIN_CLIENTS_READ = "admin:clients:read"
ADMIN_CLIENTS_WRITE = "admin:clients:write"


ADMIN_SCOPES: tuple[ScopeDef, ...] = (
    ScopeDef(
        name=ADMIN_CLIENTS_READ,
        description="List and view OIDC clients.",
        resource="admin",
        allowed_roles=(ROLE_ADMIN,),
    ),
    ScopeDef(
        name=ADMIN_CLIENTS_WRITE,
        description="Create, update, delete, and rotate secrets for OIDC clients.",
        resource="admin",
        allowed_roles=(ROLE_ADMIN,),
    ),
)


ALL_SCOPES: tuple[ScopeDef, ...] = ADMIN_SCOPES
