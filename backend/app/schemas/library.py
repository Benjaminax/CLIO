from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ReadingStatusEnum(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class LibraryItemBase(BaseModel):
    title: str
    author: Optional[str] = None
    description: Optional[str] = None
    publisher: Optional[str] = None
    language: str = "en"
    category_id: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class LibraryItemCreate(LibraryItemBase):
    pass


class LibraryItemUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    publisher: Optional[str] = None
    category_id: Optional[str] = None
    tags: Optional[List[str]] = None
    reading_status: Optional[ReadingStatusEnum] = None
    reading_progress: Optional[float] = None
    is_favourite: Optional[bool] = None
    is_archived: Optional[bool] = None


class LibraryItemResponse(BaseModel):
    id: str
    user_id: str
    title: str
    author: Optional[str] = None
    description: Optional[str] = None
    publisher: Optional[str] = None
    language: str
    file_name: str
    file_type: str
    mime_type: str
    file_size: int
    cover_image_path: Optional[str] = None
    category_id: Optional[str] = None
    tags: List[str]
    metadata: Dict[str, Any] = Field(default_factory=dict)
    chapters: Optional[List[Dict[str, Any]]] = None
    page_count: Optional[int] = None
    processing_status: str
    reading_status: str
    reading_progress: float
    is_favourite: bool
    is_archived: bool
    imported_at: datetime
    last_opened_at: Optional[datetime] = None
    updated_at: datetime


class ProgressUpdate(BaseModel):
    current_page: int
    total_pages: Optional[int] = None
    current_location: Optional[str] = None
    progress_percentage: Optional[float] = None
    duration_seconds: int = 0


class AnnotationCreate(BaseModel):
    content: str
    location: str
    page_number: Optional[int] = None
    annotation_type: str = "note"


class AnnotationResponse(BaseModel):
    id: str
    user_id: str
    library_item_id: str
    content: str
    location: str
    page_number: Optional[int] = None
    annotation_type: str
    created_at: datetime
    updated_at: datetime


class HighlightCreate(BaseModel):
    highlighted_text: str
    location: str
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    highlight_style: str = "yellow"
    note: Optional[str] = None


class HighlightResponse(BaseModel):
    id: str
    user_id: str
    library_item_id: str
    highlighted_text: str
    location: str
    page_number: Optional[int] = None
    highlight_style: str
    note: Optional[str] = None
    created_at: datetime


class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = False


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None


class CollectionResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    is_public: bool
    item_count: int = 0
    created_at: datetime
    updated_at: datetime


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    parent_id: Optional[str] = None


class CategoryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    parent_id: Optional[str] = None
    is_system_category: bool

