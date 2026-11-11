from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class HighlightCreate(BaseModel):
    library_item_id: str
    highlighted_text: str = Field(min_length=1, max_length=10000)
    location: str = Field(min_length=1, max_length=500)
    page_number: Optional[int] = Field(default=None, ge=1)
    slide_number: Optional[int] = Field(default=None, ge=1)
    highlight_style: str = Field(default="yellow", max_length=40)
    note: Optional[str] = Field(default=None, max_length=5000)


class HighlightUpdate(BaseModel):
    highlighted_text: Optional[str] = Field(default=None, min_length=1, max_length=10000)
    location: Optional[str] = Field(default=None, min_length=1, max_length=500)
    page_number: Optional[int] = Field(default=None, ge=1)
    slide_number: Optional[int] = Field(default=None, ge=1)
    highlight_style: Optional[str] = Field(default=None, max_length=40)
    note: Optional[str] = Field(default=None, max_length=5000)


class FlashcardCreate(BaseModel):
    question: str = Field(min_length=1, max_length=5000)
    answer: str = Field(min_length=1, max_length=10000)
    library_item_id: Optional[str] = None
    collection_id: Optional[str] = None
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")


class FlashcardUpdate(BaseModel):
    question: Optional[str] = Field(default=None, min_length=1, max_length=5000)
    answer: Optional[str] = Field(default=None, min_length=1, max_length=10000)
    library_item_id: Optional[str] = None
    collection_id: Optional[str] = None
    difficulty: Optional[str] = Field(default=None, pattern="^(easy|medium|hard)$")
    next_review_at: Optional[datetime] = None
    review_interval: Optional[int] = Field(default=None, ge=1)
    repetition_count: Optional[int] = Field(default=None, ge=0)


class QuizCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    library_item_id: Optional[str] = None
    questions: list[dict[str, Any]] = Field(default_factory=list)


class QuizUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    library_item_id: Optional[str] = None
    questions: Optional[list[dict[str, Any]]] = None


class KnowledgeNodeCreate(BaseModel):
    node_type: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    source_item_id: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class KnowledgeNodeUpdate(BaseModel):
    node_type: Optional[str] = Field(default=None, min_length=1, max_length=80)
    label: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    source_item_id: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class KnowledgeEdgeCreate(BaseModel):
    source_node_id: str
    target_node_id: str
    relationship_type: str = Field(min_length=1, max_length=100)
    confidence_score: float = Field(default=1.0, ge=0, le=1)
    provenance: Optional[str] = Field(default=None, max_length=1000)


class KnowledgeEdgeUpdate(BaseModel):
    relationship_type: Optional[str] = Field(default=None, min_length=1, max_length=100)
    confidence_score: Optional[float] = Field(default=None, ge=0, le=1)
    provenance: Optional[str] = Field(default=None, max_length=1000)


class ReadingSessionCreate(BaseModel):
    library_item_id: str
    started_at: Optional[datetime] = None


class ReadingSessionUpdate(BaseModel):
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = Field(default=None, ge=0)
    pages_read: Optional[int] = Field(default=None, ge=0)
    session_status: Optional[str] = Field(default=None, pattern="^(active|completed|paused)$")


class CollectionItemCreate(BaseModel):
    library_item_id: str
