from fastapi import APIRouter, Depends
from app.schemas.user import UserProfile, UpdateProfileRequest
from app.schemas.auth import ChangePasswordRequest
from app.services.user_service import UserService
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter()
user_service = UserService()

@router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    profile = await user_service.get_profile(str(current_user.id))
    return {"success": True, "data": profile.model_dump()}

@router.patch("/profile")
async def update_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
):
    profile = await user_service.update_profile(str(current_user.id), request)
    return {"success": True, "message": "Profile updated successfully", "data": profile.model_dump()}

@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
):
    await user_service.change_password(str(current_user.id), request)
    return {"success": True, "message": "Password changed successfully"}

@router.delete("/account")
async def delete_account(current_user: User = Depends(get_current_user)):
    await user_service.delete_account(str(current_user.id))
    return {"success": True, "message": "Account deactivated successfully"}

