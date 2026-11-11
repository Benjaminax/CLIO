from beanie import Document, Indexed
from pydantic import Field
from typing import Optional, List
from datetime import datetime, timezone

class ReadingProgress(Document):
    user_id: Indexed(str)
    library_item_id: Indexed(str)
    current_location: Optional[str] = None
    current_page: int = 1
    total_pages: int = 1
    progress_percentage: float = 0.0
    last_read_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reading_duration_seconds: int = 0

    class Settings:
        name = "reading_progress"
        indexes = [
            [("user_id", 1), ("library_item_id", 1)],
            "last_read_at",
        ]

class ReadingSession(Document):
    user_id: Indexed(str)
    library_item_id: Indexed(str)
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None
    duration_seconds: int = 0
    pages_read: int = 0
    session_status: str = "active"

    class Settings:
        name = "reading_sessions"
        indexes = [
            "user_id",
            "library_item_id",
            "started_at",
        ]

class DocumentContent(Document):
    user_id: Indexed(str)
    library_item_id: Indexed(str, unique=True)
    extraction_status: str = "pending"
    extraction_method: Optional[str] = None
    extracted_text_reference: Optional[str] = None
    document_metadata: dict = Field(default_factory=dict)
    extracted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "document_contents"
        indexes = [
            "user_id",
            "library_item_id",
        ]

class DocumentChunk(Document):
    user_id: Indexed(str)
    library_item_id: Indexed(str)
    chunk_index: int
    text: str
    source_location: str
    token_count: int = 0
    embedding_reference: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "document_chunks"
        indexes = [
            "user_id",
            "library_item_id",
            [("library_item_id", 1), ("chunk_index", 1)],
        ]

