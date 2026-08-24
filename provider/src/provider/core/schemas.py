from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelCaseBaseModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
        from_attributes=True,
    )


class ErrorResponse(CamelCaseBaseModel):
    """The JSON error shape returned everywhere except the OAuth endpoints,
    which must keep the RFC 6749 format or clients will not understand them."""

    code: str = Field(description="Stable machine-readable error code.")
    message: str = Field(description="Human-readable explanation.")
    details: dict[str, Any] = Field(
        default_factory=dict, description="Optional structured context."
    )


class PageMeta(CamelCaseBaseModel):
    total: int = Field(description="Total matching records.")
    limit: int = Field(description="Page size used.")
    offset: int = Field(description="Offset of the first record in this page.")
