from typing import Optional
from app.core.exceptions import NotFoundError, UnauthorizedError, DuplicateError
from app.core.security import verify_password, hash_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserProfile, UpdateProfileRequest
from app.schemas.auth import ChangePasswordRequest

class UserService:
    def __init__(self):
        self.user_repo = UserRepository()

    async def get_profile(self, user_id: str) -> UserProfile:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        return UserProfile(
            id=str(user.id),
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            profile_image=user.profile_image,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
        )

    async def update_profile(self, user_id: str, request: UpdateProfileRequest) -> UserProfile:
        if request.username:
            existing = await self.user_repo.get_by_username(request.username)
            if existing and str(existing.id) != user_id:
                raise DuplicateError("Username")

        user = await self.user_repo.update_profile(
            user_id,
            full_name=request.full_name,
            username=request.username.lower() if request.username else None,
        )
        if not user:
            raise NotFoundError("User", user_id)
        return UserProfile(
            id=str(user.id),
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            profile_image=user.profile_image,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
        )

    async def change_password(self, user_id: str, request: ChangePasswordRequest) -> None:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        if not verify_password(request.current_password, user.password_hash):
            raise UnauthorizedError("Incorrect current password")
        user.password_hash = hash_password(request.new_password)
        await user.save()

    async def delete_account(self, user_id: str) -> None:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        # Soft delete
        user.is_active = False
        await user.save()

