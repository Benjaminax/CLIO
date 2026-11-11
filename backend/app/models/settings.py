from beanie import Document, Indexed
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone

class ReadingPreferences(BaseModel):
    font: str = "default"
    font_size: int = 16
    line_spacing: float = 1.6
    theme: str = "system"
    margins: str = "normal"
    default_reading_mode: str = "paginated"

class NotificationPreferences(BaseModel):
    email_on_import: bool = True
    email_on_conversion: bool = True
    reading_reminders: bool = False

class AIPreferences(BaseModel):
    provider: str = "ollama"
    model: str = "llama3.2"
    enable_rag: bool = True

class UserSettings(Document):
    user_id: Indexed(str, unique=True)
    theme: str = "system"
    reading_preferences: ReadingPreferences = Field(default_factory=ReadingPreferences)
    interface_preferences: dict = Field(default_factory=dict)
    notification_preferences: NotificationPreferences = Field(default_factory=NotificationPreferences)
    ai_preferences: AIPreferences = Field(default_factory=AIPreferences)
    privacy_preferences: dict = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "user_settings"
        indexes = [
            "user_id",
        ]

