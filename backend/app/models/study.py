from beanie import Document, Indexed
from pydantic import Field
from typing import Optional, List
from datetime import datetime, timezone

class Flashcard(Document):
    user_id: Indexed(str)
    library_item_id: Optional[str] = None
    collection_id: Optional[str] = None
    question: str
    answer: str
    difficulty: str = "medium"
    next_review_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    review_interval: int = 1
    repetition_count: int = 0
    ease_factor: float = 2.5
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "flashcards"
        indexes = [
            "user_id",
            "library_item_id",
            "next_review_at",
        ]

class Quiz(Document):
    user_id: Indexed(str)
    library_item_id: Optional[str] = None
    title: str
    questions: List[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "quizzes"
        indexes = [
            "user_id",
            "library_item_id",
        ]

class StudySession(Document):
    user_id: Indexed(str)
    title: str
    source_item_ids: List[str] = Field(default_factory=list)
    study_type: str = "flashcards"
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None
    performance_summary: dict = Field(default_factory=dict)

    class Settings:
        name = "study_sessions"
        indexes = [
            "user_id",
            "started_at",
        ]

