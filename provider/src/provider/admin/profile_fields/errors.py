from provider.core.errors import (
    ConflictError,
    ImmutableError,
    NotFoundError,
    ValidationError,
)


class FieldNotFound(NotFoundError):
    code = "profile_field_not_found"
    message = "No such profile field."


class FieldKeyTaken(ConflictError):
    code = "profile_field_key_taken"
    message = "A profile field with this key already exists."


class SystemFieldImmutable(ImmutableError):
    code = "system_profile_field_immutable"
    message = "Built-in profile fields cannot be changed or deleted."


class UnknownGroup(NotFoundError):
    code = "unknown_group"
    message = "No group with that id."


class EnumNeedsOptions(ValidationError):
    code = "enum_needs_options"
    message = "A field of type `enum` needs at least one option."


class ReservedClaimName(ValidationError):
    code = "reserved_claim_name"
    message = (
        "That claim name is reserved by OIDC. A custom field must not be able to "
        "shadow the claims a token's meaning depends on."
    )


class UnknownClaimScope(ValidationError):
    code = "unknown_claim_scope"
    message = "No scope with that value — define it before releasing a claim under it."
