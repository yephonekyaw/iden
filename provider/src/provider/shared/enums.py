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
