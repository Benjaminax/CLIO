from typing import Optional
from datetime import datetime, timezone
from app.models.token import RefreshToken
from app.repositories.base import BaseRepository

class TokenRepository(BaseRepository[RefreshToken]):
    def __init__(self):
        super().__init__(RefreshToken)

    async def create_token(
        self,
        user_id: str,
        token_hash: str,
        expires_at: datetime,
        device_information: Optional[str] = None,
    ) -> RefreshToken:
        token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            device_information=device_information,
        )
        await token.insert()
        return token

    async def get_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        return await RefreshToken.find_one(RefreshToken.token_hash == token_hash)

    async def revoke(self, token: RefreshToken) -> None:
        token.revoked_at = datetime.now(timezone.utc)
        await token.save()

    async def revoke_all_for_user(self, user_id: str) -> None:
        tokens = await RefreshToken.find(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at == None,
        ).to_list()
        now = datetime.now(timezone.utc)
        for t in tokens:
            t.revoked_at = now
            await t.save()

    async def delete_expired(self) -> int:
        now = datetime.now(timezone.utc)
        res = await RefreshToken.find(RefreshToken.expires_at < now).delete()
        return res.deleted_count if res else 0

