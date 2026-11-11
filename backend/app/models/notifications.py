from beanie import Document, Indexed
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone

class Notification(Document):
    user_id: Indexed(str)
    title: str
    message: str
    notification_type: str = "system"  # import_success, import_failure, conversion_success, conversion_failure, etc.
    is_read: bool = False
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "notifications"
        indexes = [
            "user_id",
            "is_read",
            "created_at",
        ]

