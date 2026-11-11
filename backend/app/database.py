import logging
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

from app.models.user import User
from app.models.token import RefreshToken
from app.models.library import LibraryItem, Category, Tag, Collection, CollectionMembership
from app.models.reading import ReadingProgress, ReadingSession, DocumentContent, DocumentChunk
from app.models.annotations import Bookmark, Highlight, Annotation
from app.models.ai import AIConversation, AIMessage
from app.models.study import Flashcard, Quiz, StudySession
from app.models.graph import KnowledgeNode, KnowledgeEdge
from app.models.settings import UserSettings
from app.models.notifications import Notification
from app.models.conversions import ConversionJob
from app.models.presentations import Presentation

logger = logging.getLogger(__name__)

client: AsyncIOMotorClient = None

ALL_DOCUMENT_MODELS = [
    User,
    RefreshToken,
    LibraryItem,
    Category,
    Tag,
    Collection,
    CollectionMembership,
    DocumentContent,
    DocumentChunk,
    ReadingProgress,
    ReadingSession,
    Bookmark,
    Highlight,
    Annotation,
    Presentation,
    ConversionJob,
    AIConversation,
    AIMessage,
    KnowledgeNode,
    KnowledgeEdge,
    Flashcard,
    Quiz,
    StudySession,
    Notification,
    UserSettings,
]

async def connect_to_mongo():
    global client
    logger.info("Connecting to MongoDB...")
    client = AsyncIOMotorClient(settings.mongodb_url)
    await client.admin.command("ping")
    await init_beanie(
        database=client[settings.mongodb_database],
        document_models=ALL_DOCUMENT_MODELS,
        skip_indexes=True,
    )
    logger.info(f"Connected to MongoDB database: {settings.mongodb_database}")

async def check_mongo_connection():
    if client is None:
        raise RuntimeError("MongoDB has not been initialized")
    await client.admin.command("ping")

async def close_mongo_connection():
    global client
    if client:
        client.close()
        client = None
        logger.info("MongoDB connection closed.")
