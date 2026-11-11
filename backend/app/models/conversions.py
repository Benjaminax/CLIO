from beanie import Document, Indexed
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone

class ConversionJob(Document):
    user_id: Indexed(str)
    source_item_id: Indexed(str)
    source_format: str
    target_format: str
    status: str = "queued"  # queued, processing, completed, failed, cancelled
    progress: float = 0.0
    output_path: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

    class Settings:
        name = "conversion_jobs"
        indexes = [
            "user_id",
            "source_item_id",
            "status",
            "created_at",
        ]

