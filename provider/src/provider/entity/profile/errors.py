from provider.core.errors import ConflictError, NotFoundError, ValidationError


class UnknownField(NotFoundError):
    code = "unknown_profile_field"
    message = "No profile field with that key."


class FieldNotWritable(ValidationError):
    code = "field_not_writable"
    message = (
        "This field belongs to the organization, not to you. An administrator sets it."
    )


class ValueTaken(ConflictError):
    code = "profile_value_taken"
    message = "Someone already holds that value, and this field must be unique."


class InvalidFieldValue(ValidationError):
    code = "invalid_profile_value"
    message = "That value does not fit the field."


class PhotoTooLarge(ValidationError):
    code = "photo_too_large"
    message = "That file is too large for a profile photo."
