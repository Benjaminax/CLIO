from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from app.models.user import User
from app.repositories.base import BaseRepository

class UserRepository(BaseRepository[User]):
    def __init__(self):
        super().__init__(User)

    async def get_by_email(self, email: str) -> Optional[User]:
        return await User.find_one(User.email == email.lower())

    async def get_by_username(self, username: str) -> Optional[User]:
        return await User.find_one(User.username == username.lower())

    async def create_user(
        self,
        email: str,
        username: str,
        password_hash: str,
        full_name: Optional[str] = None,
    ) -> User:
        user = User(
            email=email.lower(),
            username=username.lower(),
            password_hash=password_hash,
            full_name=full_name,
            is_active=True,
            is_verified=False,
        )
        await user.insert()
        return user

    async def update_last_login(self, user_id: str) -> None:
        user = await self.get_by_id(user_id)
        if user:
            user.last_login_at = datetime.now(timezone.utc)
            await user.save()

    async def update_profile(self, user_id: str, **kwargs) -> Optional[User]:
        user = await self.get_by_id(user_id)
        if not user:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(user, key):
                setattr(user, key, value)
        user.updated_at = datetime.now(timezone.utc)
        await user.save()
        return user

