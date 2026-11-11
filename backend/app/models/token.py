from beanie import Document, Indexed
from pydantic import Field
from typing import Optional, Annotated
from datetime import datetime, timezone


class RefreshToken(Document):
    user_id: Annotated[str, Indexed()]
    token_hash: str
    expires_at: datetime
    revoked_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    device_information: Optional[str] = None

    class Settings:
        name = "refresh_tokens"
        indexes = [
            "user_id",
            "token_hash",
            "expires_at",
        ]

    @property
    def is_expired(self) -> bool:
        now = datetime.now(timezone.utc)
        expires = self.expires_at
        if expires.tzinfo is None:
            from datetime import timezone as tz
            expires = expires.replace(tzinfo=tz.utc)
        return now > expires

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None
