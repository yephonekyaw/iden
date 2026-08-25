from provider.core.errors import ConflictError, ValidationError


class WrongPassword(ValidationError):
    code = "wrong_password"
    message = "The current password is not correct."


class SamePassword(ValidationError):
    code = "same_password"
    message = "The new password must differ from the current one."


class EmailTaken(ConflictError):
    code = "email_taken"
    message = "Another account already uses that address."
