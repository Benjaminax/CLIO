from beanie import Document, Indexed
from pydantic import Field
from typing import Optional, List, Dict, Any, Annotated
from datetime import datetime, timezone
from enum import Enum


class ReadingStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class LibraryItem(Document):
    user_id: Annotated[str, Indexed()]
    title: str
    author: Optional[str] = None
    description: Optional[str] = None
    publisher: Optional[str] = None
    language: str = "en"

    # File info
    file_name: str
    file_type: str  # e.g. "pdf", "epub", "docx"
    mime_type: str
    file_size: int  # bytes
    storage_path: str
    cover_image_path: Optional[str] = None

    # Organisation
    category_id: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Content info
    page_count: Optional[int] = None
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    processing_error: Optional[str] = None

    # Reading state
    reading_status: ReadingStatus = ReadingStatus.NOT_STARTED
    reading_progress: float = 0.0  # 0.0–100.0
    is_favourite: bool = False
    is_archived: bool = False

    # Timestamps
    imported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_opened_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "library_items"
        indexes = [
            "user_id",
            [("user_id", 1), ("file_type", 1), ("is_archived", 1)],
            [("title", "text"), ("author", "text"), ("description", "text")],
        ]


class Category(Document):
    user_id: Optional[str] = None  # None = system-wide category
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    parent_id: Optional[str] = None  # support sub-categories
    is_system_category: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "categories"
        indexes = [
            "user_id",
            "name",
        ]


class Tag(Document):
    user_id: Annotated[str, Indexed()]
    name: str
    color: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "tags"
        indexes = [
            [("user_id", 1), ("name", 1)],  # compound unique enforced at app layer
        ]


class Collection(Document):
    user_id: Annotated[str, Indexed()]
    name: str
    description: Optional[str] = None
    cover_image_path: Optional[str] = None
    is_public: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "collections"
        indexes = ["user_id"]


class CollectionMembership(Document):
    collection_id: Annotated[str, Indexed()]
    library_item_id: Annotated[str, Indexed()]
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sort_order: int = 0

    class Settings:
        name = "collection_memberships"
        indexes = [
            "collection_id",
            "library_item_id",
            [("collection_id", 1), ("library_item_id", 1)],
        ]
