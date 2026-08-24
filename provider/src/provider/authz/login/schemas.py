from typing import Literal

from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel


class LoginRequest(CamelCaseBaseModel):
    challenge_id: str = Field(description="From the `challenge` query parameter on the login page.")
    email: str
    password: str


class TotpRequest(CamelCaseBaseModel):
    challenge_id: str
    code: str = Field(min_length=6, max_length=6, description="Six-digit code from the authenticator app.")


class AuthStepResponse(CamelCaseBaseModel):
    status: Literal["complete", "totp_required"] = Field(
        description=(
            "`complete` — follow `resumeUrl` to finish the authorization request. "
            "`totp_required` — a second factor is needed before the requested "
            "assurance level is met."
        )
    )
    resume_url: str | None = Field(
        default=None, description="Where to send the browser next. Null when a step-up is pending."
    )
    acr: str = Field(description="Assurance level reached so far.")
    amr: list[str] = Field(description="Methods used so far.")


class ChallengeScope(CamelCaseBaseModel):
    value: str
    description: str


class ChallengeResponse(CamelCaseBaseModel):
    """What the Auth UI needs to render a login or consent page — deliberately
    the minimum, so the UI never has to understand OAuth."""

    client_name: str
    scopes: list[ChallengeScope] = Field(description="Scopes the client is asking for.")
    acr_values: str | None = Field(default=None, description="Minimum assurance the client requested.")
    authenticated: bool = Field(description="Whether a session already exists in this browser.")
