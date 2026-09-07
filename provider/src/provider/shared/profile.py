"""Validation and casting for organization-defined profile values.

Values are stored as text and cast at the boundary. That is the cost of keeping
them in a table rather than a JSONB column — the price paid for real uniqueness
constraints and indexed filtering. This module is the boundary, and it is shared
because both the person editing their own profile and the administrator editing
someone else's must be held to the same field definition.
"""

import re
from datetime import date
from typing import Any

from provider.shared.enums import FieldType
from provider.shared.models import ProfileField

# Claims fixed by OIDC Core and RFC 7519. A custom field that shadowed one of
# these would let an administrator forge the meaning of a token.
RESERVED_CLAIMS = frozenset(
    {
        "iss",
        "sub",
        "aud",
        "exp",
        "nbf",
        "iat",
        "jti",
        "auth_time",
        "nonce",
        "acr",
        "amr",
        "azp",
        "sid",
        "scope",
        "client_id",
        "token_type",
        # Standard OIDC claims IDEN emits itself under `profile` and `email`.
        # A field claiming one of these names would be silently overwritten at
        # mint time, so it is refused when the field is defined instead.
        "name",
        "preferred_username",
        "picture",
        "email",
        "email_verified",
    }
)

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+$")
PHONE_PATTERN = re.compile(r"^\+?[0-9 ()\-]{6,20}$")


class InvalidValue(ValueError):
    """The value does not satisfy the field's definition."""


def coerce(field: ProfileField, raw: Any) -> str:
    """Validate `raw` against the field and return what to store.

    Raises `InvalidValue` with a message written for the person who typed it.
    """
    if raw is None or raw == "":
        if field.required:
            raise InvalidValue(f"{field.label} is required.")
        return ""

    value = _check_type(field, raw)
    _check_validators(field, value)
    return value


def _check_type(field: ProfileField, raw: Any) -> str:
    match field.data_type:
        case FieldType.INTEGER:
            try:
                return str(int(raw))
            except (TypeError, ValueError) as exc:
                raise InvalidValue(f"{field.label} must be a whole number.") from exc

        case FieldType.BOOLEAN:
            if isinstance(raw, bool):
                return "true" if raw else "false"
            if str(raw).lower() in {"true", "false"}:
                return str(raw).lower()
            raise InvalidValue(f"{field.label} must be true or false.")

        case FieldType.DATE:
            try:
                return date.fromisoformat(str(raw)).isoformat()
            except ValueError as exc:
                raise InvalidValue(
                    f"{field.label} must be a date, as YYYY-MM-DD."
                ) from exc

        case FieldType.ENUM:
            if str(raw) not in field.options:
                allowed = ", ".join(field.options)
                raise InvalidValue(f"{field.label} must be one of: {allowed}.")
            return str(raw)

        case FieldType.EMAIL:
            if not EMAIL_PATTERN.match(str(raw)):
                raise InvalidValue(f"{field.label} must be an email address.")
            return str(raw)

        case FieldType.PHONE:
            if not PHONE_PATTERN.match(str(raw)):
                raise InvalidValue(f"{field.label} must be a phone number.")
            return str(raw)

        case FieldType.URL:
            if "://" not in str(raw):
                raise InvalidValue(f"{field.label} must be a full URL.")
            return str(raw)

        case _:
            return str(raw)


def _check_validators(field: ProfileField, value: str) -> None:
    rules = field.validators or {}

    if (pattern := rules.get("pattern")) and not re.match(pattern, value):
        raise InvalidValue(f"{field.label} is not in the expected format.")

    if (minimum := rules.get("min_length")) and len(value) < minimum:
        raise InvalidValue(f"{field.label} must be at least {minimum} characters.")

    if (maximum := rules.get("max_length")) and len(value) > maximum:
        raise InvalidValue(f"{field.label} must be at most {maximum} characters.")

    if field.data_type is FieldType.INTEGER:
        number = int(value)
        if (minimum := rules.get("min")) is not None and number < minimum:
            raise InvalidValue(f"{field.label} must be at least {minimum}.")
        if (maximum := rules.get("max")) is not None and number > maximum:
            raise InvalidValue(f"{field.label} must be at most {maximum}.")


def render(field: ProfileField, stored: str) -> Any:
    """The stored text as the type the field declares — what a client reads."""
    if stored == "":
        return None
    match field.data_type:
        case FieldType.INTEGER:
            return int(stored)
        case FieldType.BOOLEAN:
            return stored == "true"
        case _:
            return stored


def applies_to(field: ProfileField, group_ids: set) -> bool:
    """Whether a field is part of this person's profile at all.

    A field bound to a group belongs only to its members — how students and
    staff get different forms without a second grouping concept.
    """
    return field.group_id is None or field.group_id in group_ids
