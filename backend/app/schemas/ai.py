from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class AIChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    library_item_ids: Optional[List[str]] = None
    system_prompt: Optional[str] = None
    context_limit: int = Field(default=5, ge=3, le=10)


class SourceReference(BaseModel):
    item_id: str
    title: str
    location: Optional[str] = None
    page: Optional[int] = None
    snippet: str


class AIChatResponse(BaseModel):
    conversation_id: str
    message: str
    sources: List[SourceReference] = Field(default_factory=list)
    model: str


class AISummarizeRequest(BaseModel):
    library_item_id: str
    length: str = "medium"  # short, medium, comprehensive
    focus_topics: Optional[List[str]] = None


class AISummarizeResponse(BaseModel):
    summary: str
    key_points: List[str]
    suggested_questions: List[str]
    model: str


class AIFlashcardsRequest(BaseModel):
    library_item_id: str
    count: int = 5
    topic: Optional[str] = None


class FlashcardItem(BaseModel):
    question: str
    answer: str
    hint: Optional[str] = None


class AIFlashcardsResponse(BaseModel):
    flashcards: List[FlashcardItem]
    model: str
