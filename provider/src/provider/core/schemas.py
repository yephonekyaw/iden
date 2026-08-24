from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends, Query
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
    total: int = Field(description="Total matching records, ignoring pagination.")
    limit: int = Field(description="Page size used.")
    offset: int = Field(description="Offset of the first record in this page.")


class Page[T](CamelCaseBaseModel):
    items: list[T]
    meta: PageMeta


@dataclass
class Pagination:
    limit: int = Query(50, ge=1, le=200, description="Maximum records to return.")
    offset: int = Query(0, ge=0, description="Records to skip.")


PaginationDep = Annotated[Pagination, Depends()]
