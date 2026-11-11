"""
Initial Index Migration for CLIO MongoDB Database.
Creates all required unique and compound indexes across collections.
"""

import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
import pymongo

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("clio.migrations")

async def run_migration(mongodb_url: str = "mongodb://localhost:27017", db_name: str = "clio_db"):
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]

    logger.info("Creating indexes for users...")
    await db.users.create_index([("email", pymongo.ASCENDING)], unique=True)
    await db.users.create_index([("username", pymongo.ASCENDING)], unique=True)

    logger.info("Creating indexes for refresh_tokens...")
    await db.refresh_tokens.create_index([("token_hash", pymongo.ASCENDING)], unique=True)
    await db.refresh_tokens.create_index([("user_id", pymongo.ASCENDING)])
    await db.refresh_tokens.create_index([("expires_at", pymongo.ASCENDING)], expireAfterSeconds=0)

    logger.info("Creating indexes for library_items...")
    await db.library_items.create_index([("user_id", pymongo.ASCENDING)])
    await db.library_items.create_index([
        ("user_id", pymongo.ASCENDING),
        ("file_type", pymongo.ASCENDING),
        ("is_archived", pymongo.ASCENDING),
    ])
    await db.library_items.create_index([
        ("title", pymongo.TEXT),
        ("author", pymongo.TEXT),
        ("description", pymongo.TEXT),
    ])

    logger.info("Creating indexes for categories and tags...")
    await db.tags.create_index([("user_id", pymongo.ASCENDING), ("name", pymongo.ASCENDING)], unique=True)
    await db.categories.create_index([("user_id", pymongo.ASCENDING), ("name", pymongo.ASCENDING)])

    logger.info("Creating indexes for collections...")
    await db.collection_memberships.create_index(
        [("collection_id", pymongo.ASCENDING), ("library_item_id", pymongo.ASCENDING)],
        unique=True,
    )

    logger.info("Creating indexes for reading progress...")
    await db.reading_progress.create_index(
        [("user_id", pymongo.ASCENDING), ("library_item_id", pymongo.ASCENDING)],
        unique=True,
    )

    logger.info("Creating indexes for document chunks...")
    await db.document_chunks.create_index([
        ("library_item_id", pymongo.ASCENDING),
        ("chunk_index", pymongo.ASCENDING),
    ])

    logger.info("Creating indexes for bookmarks, highlights, annotations...")
    await db.bookmarks.create_index([("user_id", pymongo.ASCENDING), ("library_item_id", pymongo.ASCENDING)])
    await db.highlights.create_index([("user_id", pymongo.ASCENDING), ("library_item_id", pymongo.ASCENDING)])
    await db.annotations.create_index([("user_id", pymongo.ASCENDING), ("library_item_id", pymongo.ASCENDING)])

    logger.info("Creating indexes for flashcards and study...")
    await db.flashcards.create_index([("user_id", pymongo.ASCENDING), ("next_review_at", pymongo.ASCENDING)])

    logger.info("Migration completed successfully!")
    client.close()

if __name__ == "__main__":
    import sys
    url = sys.argv[1] if len(sys.argv) > 1 else "mongodb://localhost:27017"
    database = sys.argv[2] if len(sys.argv) > 2 else "clio_db"
    asyncio.run(run_migration(url, database))

