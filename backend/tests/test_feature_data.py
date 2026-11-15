import pytest
from httpx import AsyncClient, MockTransport, Response
from uuid import uuid4

from app.api.v1.endpoints.feature_data import _verify_crossref_reference
from app.schemas.feature_data import CitationVerificationInput
import asyncio
import httpx


@pytest.mark.asyncio
async def test_feature_records_are_persisted_and_user_scoped(client: AsyncClient):
    suffix = uuid4().hex[:8]
    registration = await client.post(
        "/api/v1/auth/register",
        json={
            "email": f"feature-{suffix}@example.com",
            "username": f"feature_reader_{suffix}",
            "password": "Password123!",
            "full_name": "Feature Reader",
        },
    )
    assert registration.status_code == 201
    token = registration.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    manuscript_response = await client.post(
        "/api/v1/manuscripts",
        headers=headers,
        json={"title": "Thesis Draft", "source": "\\documentclass{article}"},
    )
    assert manuscript_response.status_code == 201
    manuscript_id = manuscript_response.json()["id"]

    listing = await client.get("/api/v1/manuscripts", headers=headers)
    assert listing.status_code == 200
    assert listing.json()[0]["title"] == "Thesis Draft"
    assert "source" not in listing.json()[0]

    detail = await client.get(f"/api/v1/manuscripts/{manuscript_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["source"] == "\\documentclass{article}"

    audit_response = await client.post(
        "/api/v1/citation-checker/audits",
        headers=headers,
        json={
            "file_name": "paper.pdf",
            "references": [
                {
                    "id": "ref-1",
                    "index": 1,
                    "rawText": "Author (2024). Research title.",
                    "title": "Research title",
                    "authors": ["Author"],
                    "year": 2024,
                    "venue": "",
                }
            ],
            "defects": [],
        },
    )
    assert audit_response.status_code == 201
    assert audit_response.json()["references"][0]["status"] == "unverified"
    assert "paper text" not in audit_response.json()

    other_registration = await client.post(
        "/api/v1/auth/register",
        json={
            "email": f"other-feature-{suffix}@example.com",
            "username": f"other_feature_reader_{suffix}",
            "password": "Password123!",
            "full_name": "Other Reader",
        },
    )
    other_token = other_registration.json()["data"]["access_token"]
    other_detail = await client.get(
        f"/api/v1/manuscripts/{manuscript_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert other_detail.status_code == 404


@pytest.mark.asyncio
async def test_crossref_match_uses_returned_metadata():
    def handler(request: httpx.Request) -> Response:
        assert request.url.params["query.title"] == "A verifiable paper title"
        return Response(
            200,
            json={
                "message": {
                    "items": [
                        {
                            "title": ["A verifiable paper title"],
                            "author": [{"given": "Ada", "family": "Lovelace"}],
                            "published-print": {"date-parts": [[2024]]},
                            "container-title": ["Journal of Test Results"],
                            "DOI": "10.1234/example",
                        }
                    ]
                }
            },
        )

    reference = CitationVerificationInput(
        id="ref-1",
        title="A verifiable paper title",
        authors=["A. Lovelace"],
        year=2024,
    )
    async with httpx.AsyncClient(transport=MockTransport(handler)) as client:
        result = await _verify_crossref_reference(client, asyncio.Semaphore(1), reference)

    assert result["status"] == "verified"
    assert result["databaseMatch"] == "Crossref"
    assert result["doi"] == "10.1234/example"
