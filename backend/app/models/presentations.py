from beanie import Document, Indexed
from pydantic import Field
from typing import Optional, List
from datetime import datetime, timezone

class Presentation(Document):
    user_id: Indexed(str)
    library_item_id: Indexed(str, unique=True)
    title: str
    slide_count: int = 0
    slides: List[dict] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
    extraction_status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "presentations"
        indexes = [
            "user_id",
            "library_item_id",
        ]

