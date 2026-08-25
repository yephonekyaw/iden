from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel


class ConsentRequest(CamelCaseBaseModel):
    challenge_id: str
    approved: bool = Field(
        description="False records a denial and returns the user to the client."
    )


class ConsentResponse(CamelCaseBaseModel):
    redirect_url: str = Field(
        description="Where to send the browser — back to /authorize on approval, "
        "or straight to the client with `error=access_denied` on refusal."
    )
