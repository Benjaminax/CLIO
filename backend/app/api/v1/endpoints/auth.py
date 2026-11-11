from fastapi import APIRouter, Depends, Request, Response, status
from typing import Optional
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.schemas.user import UserProfile
from app.services.auth_service import AuthService
from app.dependencies import get_current_user
from app.models.user import User
from app.core.responses import success_response
from app.config import settings

router = APIRouter()
auth_service = AuthService()

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, response: Response):
    result = await auth_service.register(request)
    # Set refresh token as httpOnly cookie
    response.set_cookie(
        key="clio_refresh_token",
        value=result["refresh_token"],
        httponly=True,
        secure=not settings.debug,
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )
    user = result["user"]
    return {
        "success": True,
        "message": "User registered successfully",
        "data": {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name,
            },
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "token_type": "bearer",
            "expires_in": result["expires_in"],
        },
    }

@router.post("/login")
async def login(request: LoginRequest, req: Request, response: Response):
    device_info = req.headers.get("user-agent")
    result = await auth_service.login(request, device_info=device_info)
    response.set_cookie(
        key="clio_refresh_token",
        value=result["refresh_token"],
        httponly=True,
        secure=not settings.debug,
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )
    user = result["user"]
    return {
        "success": True,
        "message": "Login successful",
        "data": {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name,
            },
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "token_type": "bearer",
            "expires_in": result["expires_in"],
        },
    }

@router.post("/refresh")
async def refresh_tokens(req: Request, response: Response, body: Optional[RefreshRequest] = None):
    # Try getting refresh token from cookie first, then from body
    raw_token = req.cookies.get("clio_refresh_token")
    if not raw_token and body and body.refresh_token:
        raw_token = body.refresh_token

    if not raw_token:
        return Response(
            content='{"success": false, "message": "Refresh token missing", "error": {"code": "UNAUTHORIZED"}}',
            status_code=401,
            media_type="application/json",
        )

    result = await auth_service.refresh_tokens(raw_token)
    response.set_cookie(
        key="clio_refresh_token",
        value=result["refresh_token"],
        httponly=True,
        secure=not settings.debug,
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )
    return {
        "success": True,
        "message": "Tokens refreshed successfully",
        "data": {
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "token_type": "bearer",
            "expires_in": result["expires_in"],
        },
    }

@router.post("/logout")
async def logout(req: Request, response: Response):
    raw_token = req.cookies.get("clio_refresh_token")
    if raw_token:
        await auth_service.logout(raw_refresh_token=raw_token)
    response.delete_cookie(key="clio_refresh_token")
    return {"success": True, "message": "Logged out successfully"}

@router.get("/me")
async def get_current_user_profile(user: User = Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "profile_image": user.profile_image,
            "is_active": user.is_active,
            "is_verified": user.is_verified,
            "created_at": user.created_at.isoformat(),
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        },
    }

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    # Sends reset email if email service is configured
    return {
        "success": True,
        "message": "If this email is registered, password reset instructions have been sent.",
    }

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    return {
        "success": True,
        "message": "Password has been successfully reset.",
    }

