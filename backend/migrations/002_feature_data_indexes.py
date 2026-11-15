import asyncio
import sys

import pymongo
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings


async def run_migration(
    mongodb_url: str = settings.mongodb_url,
    db_name: str = settings.mongodb_database,
):
    client = AsyncIOMotorClient(mongodb_url)
    try:
        db = client[db_name]
        await db.citation_audits.create_index(
            [("user_id", pymongo.ASCENDING), ("created_at", pymongo.DESCENDING)]
        )
        await db.study_mind_maps.create_index(
            [
                ("user_id", pymongo.ASCENDING),
                ("library_item_id", pymongo.ASCENDING),
                ("updated_at", pymongo.DESCENDING),
            ]
        )
        await db.latex_manuscripts.create_index(
            [("user_id", pymongo.ASCENDING), ("updated_at", pymongo.DESCENDING)]
        )
    finally:
        client.close()


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else settings.mongodb_url
    database = sys.argv[2] if len(sys.argv) > 2 else settings.mongodb_database
    asyncio.run(run_migration(url, database))
