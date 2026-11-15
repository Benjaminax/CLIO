from datetime import datetime, timezone
from typing import Any

from beanie import Document
from pydantic import Field


class CitationAudit(Document):
    user_id: str
    file_name: str
    references: list[dict[str, Any]] = Field(default_factory=list)
    defects: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "citation_audits"
        indexes = [[("user_id", 1), ("created_at", -1)]]


class StudyMindMap(Document):
    user_id: str
    library_item_id: str
    title: str
    tree: dict[str, Any]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "study_mind_maps"
        indexes = [[("user_id", 1), ("library_item_id", 1), ("updated_at", -1)]]


class LatexManuscript(Document):
    user_id: str
    title: str
    source: str = Field(max_length=1_000_000)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "latex_manuscripts"
        indexes = [[("user_id", 1), ("updated_at", -1)]]
