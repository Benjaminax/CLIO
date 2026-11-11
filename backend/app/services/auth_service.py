from datetime import datetime, timedelta, timezone
from typing import Optional
from app.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    hash_refresh_token,
)
from app.core.exceptions import (
    DuplicateError,
    UnauthorizedError,
    NotFoundError,
)
from app.models.user import User
from app.models.settings import UserSettings
from app.models.library import Category
from app.repositories.user_repository import UserRepository
from app.repositories.token_repository import TokenRepository
from app.schemas.auth import RegisterRequest, LoginRequest

DEFAULT_CATEGORIES = [
    ("Fiction and Stories", "Novels, narratives, and creative fiction"),
    ("Self-Development", "Productivity, psychology, mindset, and habits"),
    ("Education and Academic", "Textbooks, research papers, and academic lectures"),
    ("Business and Finance", "Economics, investments, markets, and leadership"),
    ("Technology and Computing", "Software engineering, computer science, and AI"),
    ("History and Politics", "Historical records, political philosophy, and society"),
    ("Biography and Memoir", "Life accounts, profiles, and historical figures"),
    ("Reference and Documents", "Guides, manuals, documentation, and source materials"),
]

class AuthService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.token_repo = TokenRepository()

    async def register(self, request: RegisterRequest) -> dict:
        existing_email = await self.user_repo.get_by_email(request.email)
        if existing_email:
            raise DuplicateError("Email")

        existing_user = await self.user_repo.get_by_username(request.username)
        if existing_user:
            raise DuplicateError("Username")

        pwd_hash = hash_password(request.password)
        user = await self.user_repo.create_user(
            email=request.email,
            username=request.username,
            password_hash=pwd_hash,
            full_name=request.full_name,
        )

        user_id_str = str(user.id)

        # Seed initial user settings
        settings_doc = UserSettings(user_id=user_id_str)
        await settings_doc.insert()

        # Seed default categories
        for name, desc in DEFAULT_CATEGORIES:
            cat = Category(
                user_id=user_id_str,
                name=name,
                description=desc,
                is_system_category=True,
            )
            await cat.insert()

        # Generate tokens
        access_token = create_access_token(
            data={"sub": user_id_str, "email": user.email},
            expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
            secret_key=settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )
        raw_refresh, hashed_refresh = create_refresh_token()
        refresh_expires = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
        await self.token_repo.create_token(
            user_id=user_id_str,
            token_hash=hashed_refresh,
            expires_at=refresh_expires,
        )

        return {
            "user": user,
            "access_token": access_token,
            "refresh_token": raw_refresh,
            "expires_in": settings.jwt_access_token_expire_minutes * 60,
        }

    async def login(self, request: LoginRequest, device_info: Optional[str] = None) -> dict:
        user = await self.user_repo.get_by_email(request.email)
        if not user or not verify_password(request.password, user.password_hash):
            raise UnauthorizedError("Invalid email or password")

        if not user.is_active:
            raise UnauthorizedError("Account is inactive")

        user_id_str = str(user.id)
        await self.user_repo.update_last_login(user_id_str)

        access_token = create_access_token(
            data={"sub": user_id_str, "email": user.email},
            expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
            secret_key=settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )
        raw_refresh, hashed_refresh = create_refresh_token()
        refresh_expires = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
        await self.token_repo.create_token(
            user_id=user_id_str,
            token_hash=hashed_refresh,
            expires_at=refresh_expires,
            device_information=device_info,
        )

        return {
            "user": user,
            "access_token": access_token,
            "refresh_token": raw_refresh,
            "expires_in": settings.jwt_access_token_expire_minutes * 60,
        }

    async def refresh_tokens(self, raw_refresh_token: str) -> dict:
        hashed = hash_refresh_token(raw_refresh_token)
        stored_token = await self.token_repo.get_by_hash(hashed)
        if not stored_token or stored_token.is_revoked or stored_token.is_expired:
            raise UnauthorizedError("Invalid or expired refresh token")

        user = await self.user_repo.get_by_id(stored_token.user_id)
        if not user or not user.is_active:
            raise UnauthorizedError("User not found or inactive")

        # Rotation: revoke old token
        await self.token_repo.revoke(stored_token)

        user_id_str = str(user.id)
        access_token = create_access_token(
            data={"sub": user_id_str, "email": user.email},
            expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
            secret_key=settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )
        new_raw_refresh, new_hashed_refresh = create_refresh_token()
        refresh_expires = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
        await self.token_repo.create_token(
            user_id=user_id_str,
            token_hash=new_hashed_refresh,
            expires_at=refresh_expires,
            device_information=stored_token.device_information,
        )

        return {
            "access_token": access_token,
            "refresh_token": new_raw_refresh,
            "expires_in": settings.jwt_access_token_expire_minutes * 60,
        }

    async def logout(self, raw_refresh_token: Optional[str] = None, user_id: Optional[str] = None) -> None:
        if raw_refresh_token:
            hashed = hash_refresh_token(raw_refresh_token)
            stored_token = await self.token_repo.get_by_hash(hashed)
            if stored_token:
                await self.token_repo.revoke(stored_token)
        elif user_id:
            await self.token_repo.revoke_all_for_user(user_id)

