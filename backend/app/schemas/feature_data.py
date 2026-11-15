from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)


class CitationReferenceData(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    index: int = Field(ge=1)
    raw_text: str = Field(alias="rawText", min_length=1, max_length=4_000)
    title: str = Field(max_length=2_000)
    authors: list[str] = Field(default_factory=list, max_length=30)
    year: int | None = Field(default=None, ge=1000, le=3000)
    venue: str = Field(default="", max_length=1_000)
    doi: str | None = Field(default=None, max_length=300)
    status: Literal["verified", "metadata_mismatch", "missing", "hallucinated", "unverified"] = "unverified"
    confidence_score: int = Field(default=0, alias="confidenceScore", ge=0, le=100)
    database_match: str | None = Field(default=None, alias="databaseMatch", max_length=200)
    mismatches: list[str] = Field(default_factory=list, max_length=20)


class CitationDefectData(BaseModel):
    type: Literal["gap", "out_of_order", "uncited", "undefined", "duplicate", "range_error"]
    severity: Literal["high", "medium", "low"]
    marker: str | None = Field(default=None, max_length=100)
    index: int | None = Field(default=None, ge=1)
    description: str = Field(max_length=2_000)
    suggestion: str = Field(max_length=2_000)


class CitationAuditCreate(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    references: list[CitationReferenceData] = Field(min_length=1, max_length=200)
    defects: list[CitationDefectData] = Field(default_factory=list, max_length=500)


class CitationVerificationInput(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=2_000)
    authors: list[str] = Field(default_factory=list, max_length=30)
    year: int | None = Field(default=None, ge=1000, le=3000)


class CitationVerificationRequest(BaseModel):
    references: list[CitationVerificationInput] = Field(min_length=1, max_length=50)


class MindMapNode(ApiModel):
    id: str = Field(default_factory=lambda: str(uuid4()), min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=300)
    category: Literal["central", "theme", "concept", "action"]
    priority: Literal["high", "medium", "low"] = "medium"
    mastery_status: Literal["to_learn", "in_progress", "mastered"] = "to_learn"
    summary: str = Field(default="", max_length=2_000)
    key_takeaway: str = Field(default="", max_length=2_000)
    formula_or_rule: str | None = Field(default=None, max_length=1_000)
    children: list["MindMapNode"] = Field(default_factory=list, max_length=30)


class MindMapGenerate(ApiModel):
    library_item_id: str = Field(min_length=1, max_length=100)


class MindMapStatusUpdate(ApiModel):
    mastery_status: Literal["to_learn", "in_progress", "mastered"]


class ManuscriptCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    source: str = Field(max_length=1_000_000)


class ManuscriptUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    source: str | None = Field(default=None, max_length=1_000_000)
