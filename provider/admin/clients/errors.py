"""Domain exceptions raised by the client-admin service layer."""


class ClientError(Exception):
    """Base class for admin client errors."""


class ClientNotFound(ClientError):
    pass


class OrgNotFound(ClientError):
    pass


class PublicClientError(ClientError):
    """Operation invalid for a public client (e.g. rotating a non-existent secret)."""


class ClientInUseError(ClientError):
    """Client cannot be deleted because other rows still reference it."""
