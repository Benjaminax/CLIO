import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.main import app
from app.database import ALL_DOCUMENT_MODELS
from app.config import settings

TEST_DB_NAME = "clio_test_db"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[TEST_DB_NAME]
    await init_beanie(database=db, document_models=ALL_DOCUMENT_MODELS)
    yield
    # Cleanup after all tests
    await client.drop_database(TEST_DB_NAME)
    client.close()

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

