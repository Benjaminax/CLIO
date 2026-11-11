# CLIO — Backend Engine (Phase 1)

**Universal Reading, Document Management, Knowledge Graph, and AI Learning Platform.**

"Read. Understand. Connect. Remember."

---

## Architecture Overview

- **Framework:** FastAPI (Python 3.12+)
- **Database:** MongoDB (Beanie ODM + Motor Async)
- **Authentication:** JWT Access Tokens + Hashed Refresh Tokens (Argon2 password hashing)
- **Background Jobs:** Celery + Redis
- **Models:** 24+ collections covering users, library items, reading progress, annotations, bookmarks, presentations, conversion jobs, AI chat & citations, knowledge graph, study/flashcards, notifications, and user settings.

---

## Getting Started (Local Development)

### 1. Prerequisites

- Python 3.12+
- MongoDB instance (MongoDB Atlas or local MongoDB)
- Redis (via Docker or local Redis)

### 2. Setup Virtual Environment

```bash
cd backend
python -m venv .venv

# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# On Linux/macOS:
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your `MONGODB_URL`, `MONGODB_DATABASE`, and generate a secure `JWT_SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 5. Run Migrations / Initialize Indexes

```bash
python migrations/001_initial_indexes.py
```

### 6. Start the Server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Interactive API Documentation

- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

The API pings MongoDB during startup and will not start if the database is unreachable. The health check also verifies MongoDB and returns `"database": "connected"` when the database is available. Authenticated account pages in CLIO use the API and MongoDB; they do not silently substitute browser storage if a request fails.

## Connecting the Android APK

The APK is a client of the backend; MongoDB, Redis, and the Celery worker must remain running on the backend host. Start the API on all network interfaces:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

For an Android emulator, the app tries `http://10.0.2.2:8000` automatically. For a physical phone, set `VITE_ANDROID_API_URL` to the backend host's LAN address before building, for example `http://192.168.1.25:8000`, or enter that address in **Settings → Backend API address** inside the APK. The phone and backend host must be on the same network, and port 8000 must be reachable through the host firewall.

The Android build permits cleartext HTTP for local development. Use an HTTPS reverse proxy and an HTTPS `VITE_ANDROID_API_URL` for production deployments.

## Account-backed workspace APIs

These routes require a bearer access token:

- `GET`, `POST`, `PATCH`, `DELETE /api/v1/collections` — collection CRUD.
- `GET`, `POST`, `DELETE /api/v1/collections/{collection_id}/items` — collection membership; `PATCH /api/v1/collections/{collection_id}` updates collection details.
- `GET`, `POST`, `PATCH`, `DELETE /api/v1/highlights` — highlight CRUD.
- `GET`, `POST`, `PATCH`, `DELETE /api/v1/study/flashcards` and `/api/v1/study/quizzes` — study content CRUD.
- `GET /api/v1/knowledge`, plus node and edge `POST`, `PATCH`, and `DELETE` routes under `/api/v1/knowledge/nodes` and `/api/v1/knowledge/edges`.
- `GET /api/v1/reading/progress`, reading-session CRUD under `/api/v1/reading/sessions`, and `DELETE /api/v1/reading/progress/{library_item_id}`.
- `GET` and `PATCH /api/v1/users/profile` — profile read/update.

The endpoints scope reads and writes to the authenticated user and verify ownership of linked library items and knowledge-graph nodes.

---

## Running with Docker Compose

```bash
docker compose up --build
```

This spins up the FastAPI app on port 8000, Redis on port 6379, and a Celery worker.

---

## Running Tests

```bash
pytest tests/
```
