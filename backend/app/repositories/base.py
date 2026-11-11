from typing import TypeVar, Generic, Type, Optional, List
from beanie import Document
from bson import ObjectId

T = TypeVar("T", bound=Document)

class BaseRepository(Generic[T]):
    def __init__(self, model: Type[T]):
        self.model = model

    async def get_by_id(self, id: str) -> Optional[T]:
        try:
            return await self.model.get(ObjectId(id))
        except Exception:
            return None

    async def find_one(self, **kwargs) -> Optional[T]:
        return await self.model.find_one(kwargs)

    async def find_many(self, skip: int = 0, limit: int = 20, **kwargs) -> List[T]:
        return await self.model.find(kwargs).skip(skip).limit(limit).to_list()

    async def count(self, **kwargs) -> int:
        return await self.model.find(kwargs).count()

    async def delete(self, doc: T) -> None:
        await doc.delete()

