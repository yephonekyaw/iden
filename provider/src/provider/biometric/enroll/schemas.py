from uuid import UUID

from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel


class EnrollResponse(CamelCaseBaseModel):
    enrolled: bool = Field(
        description="Constant `true` — a non-2xx status means enrollment failed."
    )
    user_id: UUID = Field(description="The user the face was enrolled for.")
