from beanie import Document, Indexed
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone

class KnowledgeNode(Document):
    user_id: Indexed(str)
    node_type: str
    label: str
    description: Optional[str] = None
    source_item_id: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "knowledge_nodes"
        indexes = [
            "user_id",
            "node_type",
            "source_item_id",
        ]

class KnowledgeEdge(Document):
    user_id: Indexed(str)
    source_node_id: Indexed(str)
    target_node_id: Indexed(str)
    relationship_type: str
    confidence_score: float = 1.0
    provenance: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "knowledge_edges"
        indexes = [
            "user_id",
            "source_node_id",
            "target_node_id",
            [("source_node_id", 1), ("target_node_id", 1)],
        ]

