"""Canonical role values for ``User.role`` and ``Scope.allowed_roles``.

Roles are a small fixed set and don't warrant their own table. Importing
from here gives type-checker coverage wherever a role value is assigned
or compared.
"""

from typing import Literal

Role = Literal["admin", "user"]

ROLE_ADMIN: Role = "admin"
ROLE_USER: Role = "user"

ALL_ROLES: tuple[Role, ...] = (ROLE_ADMIN, ROLE_USER)
