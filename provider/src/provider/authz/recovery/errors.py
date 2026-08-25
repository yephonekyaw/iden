from provider.core.errors import ValidationError


class InvalidResetToken(ValidationError):
    code = "invalid_reset_token"
    message = "This link has expired or has already been used. Ask for a new one."
