from pydantic import BaseModel
from typing import Any, Optional, Generic, TypeVar
from fastapi.responses import JSONResponse

T = TypeVar("T")

class SuccessResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str
    data: Optional[T] = None
    meta: Optional[dict] = None

class ErrorDetail(BaseModel):
    code: str
    details: Optional[dict] = None

class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    error: Optional[ErrorDetail] = None

class PaginationMeta(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int

def success_response(message: str, data: Any = None, meta: Any = None, status_code: int = 200):
    return JSONResponse(
        status_code=status_code,
        content={"success": True, "message": message, "data": data, "meta": meta}
    )

def error_response(message: str, code: str = "ERROR", details: dict = None, status_code: int = 400):
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": message,
            "error": {"code": code, "details": details}
        }
    )

