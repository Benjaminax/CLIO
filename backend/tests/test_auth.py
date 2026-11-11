import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    payload = {
        "email": "reader@example.com",
        "username": "clio_reader",
        "password": "Password123!",
        "full_name": "Clio Reader",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert "access_token" in data["data"]
    assert data["data"]["user"]["email"] == "reader@example.com"

@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    payload = {
        "email": "reader@example.com",
        "username": "reader_two",
        "password": "Password123!",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "DUPLICATE_VALUE"

@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient):
    payload = {
        "email": "different@example.com",
        "username": "clio_reader",
        "password": "Password123!",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "DUPLICATE_VALUE"

@pytest.mark.asyncio
async def test_register_invalid_password(client: AsyncClient):
    payload = {
        "email": "invalid_pwd@example.com",
        "username": "shortpwd",
        "password": "short",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    payload = {
        "email": "reader@example.com",
        "password": "Password123!",
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "access_token" in data["data"]

@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    payload = {
        "email": "reader@example.com",
        "password": "WrongPassword999!",
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    payload = {
        "email": "nobody@example.com",
        "password": "Password123!",
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_get_me_no_auth(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code in (401, 403)

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

