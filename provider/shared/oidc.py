"""Canonical enums for OIDC client metadata.

Kept alongside ``shared/roles.py`` so type-checkers and Pydantic schemas
can import the same Literal definitions used by the ORM layer.
"""

from typing import Literal

ClientKind = Literal["web", "spa", "kiosk", "service"]

GrantType = Literal["authorization_code", "refresh_token", "client_credentials"]

ResponseType = Literal["code"]

ClientStatus = Literal["active", "disabled"]

TokenEndpointAuthMethod = Literal[
    "client_secret_basic",
    "client_secret_post",
    "none",
]
