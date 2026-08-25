from enum import StrEnum


class ClientType(StrEnum):
    PUBLIC = "public"
    CONFIDENTIAL = "confidential"


class GrantType(StrEnum):
    AUTHORIZATION_CODE = "authorization_code"
    REFRESH_TOKEN = "refresh_token"
    CLIENT_CREDENTIALS = "client_credentials"


class CodeChallengeMethod(StrEnum):
    S256 = "S256"


class Prompt(StrEnum):
    """`prompt` values on /authorize — OIDC Core §3.1.2.1.

    `SELECT_ACCOUNT` is accepted and treated as re-authentication: IDEN holds
    one account per session, so there is nothing to select between, and
    refusing a value a conforming client may send would break it for no gain.
    """

    NONE = "none"
    LOGIN = "login"
    CONSENT = "consent"
    SELECT_ACCOUNT = "select_account"


class AmrMethod(StrEnum):
    """RFC 8176 authentication method references IDEN emits."""

    PWD = "pwd"
    OTP = "otp"
    FACE = "face"
    MFA = "mfa"


class AcrLevel(StrEnum):
    """Derived from the session's amr list at token-issuance time, never stored."""

    LOA1 = "iden:loa:1"
    LOA2 = "iden:loa:2"
    LOA3 = "iden:loa:3"


class FieldType(StrEnum):
    """The data types an organization can give a profile field.

    Values are stored as text and cast at the boundary — see `ProfileField` for
    why the table is shaped that way rather than as a JSONB column.
    """

    STRING = "string"
    INTEGER = "integer"
    BOOLEAN = "boolean"
    DATE = "date"
    ENUM = "enum"
    EMAIL = "email"
    PHONE = "phone"
    URL = "url"
