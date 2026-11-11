from beanie import Document, Indexed
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone

class Bookmark(Document):
    user_id: Indexed(str)
    library_item_id: Indexed(str)
    location: str
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    title: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "bookmarks"
        indexes = [
            "user_id",
            "library_item_id",
            [("user_id", 1), ("library_item_id", 1)],
        ]

class Highlight(Document):
    user_id: Indexed(str)
    library_item_id: Indexed(str)
    highlighted_text: str
    location: str
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    highlight_style: str = "yellow"
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "highlights"
        indexes = [
            "user_id",
            "library_item_id",
            [("user_id", 1), ("library_item_id", 1)],
            "created_at",
        ]

class Annotation(Document):
    user_id: Indexed(str)
    library_item_id: Indexed(str)
    annotation_type: str = "note"
    content: str
    location: str
    page_number: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "annotations"
        indexes = [
            "user_id",
            "library_item_id",
            [("user_id", 1), ("library_item_id", 1)],
        ]

