from beanie import Document, Indexed
from pydantic import EmailStr, Field
from typing import Optional, Annotated
from datetime import datetime, timezone


class User(Document):
    email: Annotated[EmailStr, Indexed(unique=True)]
    username: Annotated[str, Indexed(unique=True)]
    password_hash: str
    full_name: Optional[str] = None
    profile_image: Optional[str] = None
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login_at: Optional[datetime] = None

    class Settings:
        name = "users"
