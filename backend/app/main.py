from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from pymongo.errors import PyMongoError
from app.config import settings
from app.database import check_mongo_connection, connect_to_mongo, close_mongo_connection
from app.core.exceptions import CLIOException, clio_exception_handler, validation_exception_handler
from app.core.middleware import RequestLoggingMiddleware
from app.core.logging import setup_logging
from app.api.v1.router import api_router

setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()

app = FastAPI(
    title="CLIO API",
    description="CLIO — Universal Reading, Knowledge, and Learning Platform API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware
origins = [
    settings.frontend_url,
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
    "http://localhost:5173",
    "http://localhost:8443",
    "http://127.0.0.1:8443",
    "http://10.0.2.2:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^(https?|capacitor)://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RequestLoggingMiddleware)
app.add_exception_handler(CLIOException, clio_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

app.include_router(api_router)

@app.get("/health", tags=["Health"])
async def health_check():
    try:
        await check_mongo_connection()
    except (PyMongoError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB is unavailable",
        ) from exc

    return {
        "status": "healthy",
        "service": "clio-backend",
        "version": "1.0.0",
        "database": "connected",
    }
