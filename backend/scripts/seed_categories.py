import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("clio.seed")

DEFAULT_CATEGORIES = [
    {"name": "Fiction and Stories", "description": "Novels, narratives, and creative fiction", "is_system_category": True},
    {"name": "Self-Development", "description": "Productivity, psychology, mindset, and habits", "is_system_category": True},
    {"name": "Education and Academic", "description": "Textbooks, research papers, and academic lectures", "is_system_category": True},
    {"name": "Business and Finance", "description": "Economics, investments, markets, and leadership", "is_system_category": True},
    {"name": "Technology and Computing", "description": "Software engineering, computer science, and AI", "is_system_category": True},
    {"name": "History and Politics", "description": "Historical records, political philosophy, and society", "is_system_category": True},
    {"name": "Biography and Memoir", "description": "Life accounts, profiles, and historical figures", "is_system_category": True},
    {"name": "Reference and Documents", "description": "Guides, manuals, documentation, and source materials", "is_system_category": True},
]

async def seed_system_categories(mongodb_url: str = "mongodb://localhost:27017", db_name: str = "clio_db"):
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]

    logger.info("Seeding system categories...")
    for cat in DEFAULT_CATEGORIES:
        exists = await db.categories.find_one({"name": cat["name"], "is_system_category": True})
        if not exists:
            await db.categories.insert_one(cat)
            logger.info(f"Created category: {cat['name']}")
        else:
            logger.info(f"Category already exists: {cat['name']}")

    logger.info("Category seeding completed!")
    client.close()

if __name__ == "__main__":
    import sys
    url = sys.argv[1] if len(sys.argv) > 1 else "mongodb://localhost:27017"
    database = sys.argv[2] if len(sys.argv) > 2 else "clio_db"
    asyncio.run(seed_system_categories(url, database))

