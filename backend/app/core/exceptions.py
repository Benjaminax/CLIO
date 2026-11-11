from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

class CLIOException(Exception):
    def __init__(self, message: str, code: str = "ERROR", status_code: int = 400, details: dict = None):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}

class NotFoundError(CLIOException):
    def __init__(self, resource: str, resource_id: str = None):
        super().__init__(
            message=f"{resource} not found",
            code="RESOURCE_NOT_FOUND",
            status_code=404,
            details={"resource": resource, "id": resource_id}
        )

class UnauthorizedError(CLIOException):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message=message, code="UNAUTHORIZED", status_code=401)

class ForbiddenError(CLIOException):
    def __init__(self, message: str = "Access forbidden"):
        super().__init__(message=message, code="FORBIDDEN", status_code=403)

class DuplicateError(CLIOException):
    def __init__(self, field: str):
        super().__init__(
            message=f"{field} already exists",
            code="DUPLICATE_VALUE",
            status_code=409,
            details={"field": field}
        )

async def clio_exception_handler(request: Request, exc: CLIOException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": exc.message, "error": {"code": exc.code, "details": exc.details}}
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        errors.append({"field": " -> ".join(str(loc) for loc in error["loc"]), "message": error["msg"]})
    return JSONResponse(
        status_code=422,
        content={"success": False, "message": "Validation failed", "error": {"code": "VALIDATION_ERROR", "details": {"errors": errors}}}
    )

