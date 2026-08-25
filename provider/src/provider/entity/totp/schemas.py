from datetime import datetime

from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel


class TotpStatus(CamelCaseBaseModel):
    enrolled: bool = Field(description="True only once a code has been confirmed.")
    confirmed_at: datetime | None


class TotpEnrollment(CamelCaseBaseModel):
    secret: str = Field(description="Base32 secret, for manual entry.")
    uri: str = Field(
        description="`otpauth://` URI to render as a QR code. Contains the secret."
    )


class TotpConfirm(CamelCaseBaseModel):
    code: str = Field(min_length=6, max_length=6)
