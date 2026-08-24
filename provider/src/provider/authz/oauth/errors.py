"""OAuth protocol errors.

These do **not** use the project's JSON error contract: RFC 6749 §5.2 fixes the
shape as `{"error": ..., "error_description": ...}`, and a client library will
not understand anything else.
"""


class OAuthError(Exception):
    """An error to render as JSON, because it cannot safely be redirected."""

    status_code = 400

    def __init__(self, error: str, description: str, status_code: int | None = None) -> None:
        self.error = error
        self.description = description
        if status_code is not None:
            self.status_code = status_code
        super().__init__(f"{error}: {description}")


class RedirectableError(OAuthError):
    """An error to deliver to the client's redirect_uri — RFC 6749 §4.1.2.1.

    Only raised *after* client_id and redirect_uri have been validated. Before
    that point the URI is unverified and sending anything to it would turn the
    authorization endpoint into an open redirector.
    """

    def __init__(self, error: str, description: str, redirect_uri: str, state: str | None) -> None:
        super().__init__(error, description)
        self.redirect_uri = redirect_uri
        self.state = state


class InvalidClient(OAuthError):
    def __init__(self, description: str = "Client authentication failed.") -> None:
        super().__init__("invalid_client", description, status_code=401)


class InvalidGrant(OAuthError):
    def __init__(self, description: str) -> None:
        super().__init__("invalid_grant", description)
