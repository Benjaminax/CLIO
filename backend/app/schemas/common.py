from pydantic import BaseModel
from typing import Generic, TypeVar, List, Optional

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    data: List[T]
    meta: dict

class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    database: str

