from typing import Any


class IdenError(Exception):
    """
    Base for every domain exception.

    Services raise these; routes translate them into HTTPException. Nothing in a
    service should know about HTTP status codes.
    """

    code = "internal_error"
    message = "An unexpected error occurred."

    def __init__(self, message: str | None = None, **details: Any) -> None:
        self.message = message or self.message
        self.details = details
        super().__init__(self.message)


class NotFoundError(IdenError):
    code = "not_found"
    message = "The requested resource does not exist."


class ConflictError(IdenError):
    code = "conflict"
    message = "The request conflicts with the current state."


class ImmutableError(ConflictError):
    code = "immutable"
    message = "System-defined resources cannot be modified or deleted."


class ValidationError(IdenError):
    code = "validation_error"
    message = "The request is invalid."


class UnavailableError(IdenError):
    """Something the request needs is not attached to this deployment.

    Separate from a 500: nothing is broken and there is nothing to retry — the
    feature is simply not configured here.
    """

    code = "unavailable"
    message = "This feature is not available on this deployment."


class RateLimitedError(IdenError):
    """Too many attempts. Carries how long to wait, because a client that is
    not told simply retries immediately."""

    code = "rate_limited"
    message = "Too many attempts. Try again shortly."

    def __init__(self, retry_after: int, message: str | None = None) -> None:
        super().__init__(message, retry_after=retry_after)
        self.retry_after = retry_after
