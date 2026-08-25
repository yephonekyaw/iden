from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel


class PasswordResetRequest(CamelCaseBaseModel):
    email: str = Field(max_length=255)


class PasswordResetConfirm(CamelCaseBaseModel):
    token: str = Field(description="From the emailed link. Single use, 15 minutes.")
    new_password: str = Field(min_length=12, max_length=256)
