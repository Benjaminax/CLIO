from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, library, ai, collections, workspace

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(library.router, prefix="/library", tags=["Library"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI & Knowledge"])
api_router.include_router(collections.router, prefix="/collections", tags=["Collections"])
api_router.include_router(workspace.router, tags=["Workspace"])
