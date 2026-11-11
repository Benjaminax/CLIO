from beanie import Document, Indexed
from pydantic import Field
from typing import Optional, List
from datetime import datetime, timezone

class AIConversation(Document):
    user_id: Indexed(str)
    title: str = "New Conversation"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "ai_conversations"
        indexes = [
            "user_id",
            "updated_at",
        ]

class AIMessage(Document):
    conversation_id: Indexed(str)
    user_id: Indexed(str)
    role: str
    content: str
    source_references: List[dict] = Field(default_factory=list)
    token_usage: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "ai_messages"
        indexes = [
            "conversation_id",
            "user_id",
            "created_at",
        ]

