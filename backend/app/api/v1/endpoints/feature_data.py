import asyncio
import re
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any, Type

import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.config import settings
from app.dependencies import get_current_user
from app.models.feature_data import CitationAudit, LatexManuscript, StudyMindMap
from app.models.user import User
from app.schemas.feature_data import (
    CitationAuditCreate,
    CitationVerificationRequest,
    ManuscriptCreate,
    ManuscriptUpdate,
    MindMapStatusUpdate,
)

router = APIRouter()


def _serialize(document: Any) -> dict[str, Any]:
    data = document.model_dump()
    data["id"] = str(document.id)
    data.pop("_id", None)
    data.pop("revision_id", None)
    return data


async def _owned_document(model: Type[Any], document_id: str, user_id: str):
    try:
        document = await model.get(ObjectId(document_id))
    except (TypeError, ValueError):
        document = None
    if not document or document.user_id != user_id:
        return None
    return document


@router.get("/citation-checker/audits")
async def list_citation_audits(
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=100),
):
    documents = await CitationAudit.find(
        {"user_id": str(current_user.id)}
    ).sort("-created_at").limit(limit).to_list()
    return [
        {
            "id": str(document.id),
            "file_name": document.file_name,
            "references_count": len(document.references),
            "defects_count": len(document.defects),
            "created_at": document.created_at,
        }
        for document in documents
    ]


@router.post(
    "/citation-checker/audits",
    status_code=status.HTTP_201_CREATED,
)
async def create_citation_audit(
    data: CitationAuditCreate,
    current_user: User = Depends(get_current_user),
):
    audit = CitationAudit(
        user_id=str(current_user.id),
        file_name=data.file_name,
        references=[reference.model_dump(by_alias=True) for reference in data.references],
        defects=[defect.model_dump() for defect in data.defects],
    )
    await audit.insert()
    return _serialize(audit)


@router.get("/citation-checker/audits/{audit_id}")
async def get_citation_audit(
    audit_id: str,
    current_user: User = Depends(get_current_user),
):
    audit = await _owned_document(CitationAudit, audit_id, str(current_user.id))
    if not audit:
        raise HTTPException(status_code=404, detail="Citation audit not found")
    return _serialize(audit)


@router.patch("/citation-checker/audits/{audit_id}")
async def update_citation_audit(
    audit_id: str,
    data: CitationAuditCreate,
    current_user: User = Depends(get_current_user),
):
    audit = await _owned_document(CitationAudit, audit_id, str(current_user.id))
    if not audit:
        raise HTTPException(status_code=404, detail="Citation audit not found")
    audit.file_name = data.file_name
    audit.references = [
        reference.model_dump(by_alias=True) for reference in data.references
    ]
    audit.defects = [defect.model_dump() for defect in data.defects]
    audit.created_at = datetime.now(timezone.utc)
    await audit.save()
    return _serialize(audit)


def _normalized_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def _crossref_year(work: dict[str, Any]) -> int | None:
    for field in ("published-print", "published-online", "published", "created"):
        date_value = work.get(field)
        if not isinstance(date_value, dict):
            continue
        date_parts = date_value.get("date-parts", [])
        if isinstance(date_parts, list) and date_parts and isinstance(date_parts[0], list) and date_parts[0]:
            try:
                return int(date_parts[0][0])
            except (TypeError, ValueError):
                continue
    return None


async def _verify_crossref_reference(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    reference: Any,
) -> dict[str, Any]:
    async with semaphore:
        response = await client.get(
            "https://api.crossref.org/works",
            params={"query.title": reference.title, "rows": 1},
        )
    if not response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Crossref lookup failed with HTTP {response.status_code}.",
        )
    try:
        works = response.json().get("message", {}).get("items", [])
    except (ValueError, AttributeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Crossref returned an invalid response.",
        ) from exc

    if not isinstance(works, list):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Crossref returned an invalid work list.",
        )
    if not works:
        return {
            "id": reference.id,
            "status": "unverified",
            "confidenceScore": 0,
            "databaseMatch": None,
            "mismatches": [],
        }

    work = works[0]
    if not isinstance(work, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Crossref returned an invalid work record.",
        )
    title_values = work.get("title") or []
    if not isinstance(title_values, list) or not title_values or not isinstance(title_values[0], str):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Crossref returned an invalid work title.",
        )
    matched_title = title_values[0]
    score = SequenceMatcher(
        None,
        _normalized_text(reference.title),
        _normalized_text(matched_title),
    ).ratio()
    indexed_year = _crossref_year(work)
    indexed_authors = [
        author for author in (work.get("author") or []) if isinstance(author, dict)
    ]
    matched_authors = [
        " ".join(part for part in (author.get("given"), author.get("family")) if part)
        for author in indexed_authors
        if isinstance(author, dict)
    ]
    matched_venue = (work.get("container-title") or [""])[0]
    mismatches: list[str] = []
    if score < 0.95:
        mismatches.append("Title differs from the closest Crossref record.")
    if reference.year and indexed_year and reference.year != indexed_year:
        mismatches.append(f"Year differs from the Crossref record ({indexed_year}).")
    if reference.authors and indexed_authors:
        raw_last_name = _normalized_text(reference.authors[0].split()[-1])
        indexed_last_name = _normalized_text(str(indexed_authors[0].get("family", "")))
        if raw_last_name and indexed_last_name and raw_last_name != indexed_last_name:
            mismatches.append("First author differs from the Crossref record.")

    if score < 0.75:
        result_status = "unverified"
        mismatches = []
    else:
        result_status = "metadata_mismatch" if mismatches else "verified"

    return {
        "id": reference.id,
        "status": result_status,
        "confidenceScore": round(score * 100),
        "databaseMatch": "Crossref",
        "doi": work.get("DOI"),
        "matchedTitle": matched_title,
        "matchedYear": indexed_year,
        "matchedAuthors": matched_authors,
        "matchedVenue": matched_venue,
        "mismatches": mismatches,
    }


@router.post(
    "/citation-checker/verify",
    dependencies=[Depends(get_current_user)],
)
async def verify_citations_with_crossref(
    data: CitationVerificationRequest,
):
    semaphore = asyncio.Semaphore(5)
    timeout = httpx.Timeout(12.0)
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            headers={"User-Agent": "CLIO citation checker/1.0"},
        ) as client:
            results = await asyncio.gather(
                *(
                    _verify_crossref_reference(client, semaphore, reference)
                    for reference in data.references
                )
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Crossref could not be reached. No references were marked verified.",
        ) from exc
    return {"results": results, "database": "Crossref"}


@router.get("/study/mind-maps")
async def list_mind_maps(
    current_user: User = Depends(get_current_user),
    library_item_id: str | None = Query(default=None, max_length=100),
):
    query: dict[str, Any] = {"user_id": str(current_user.id)}
    if library_item_id:
        query["library_item_id"] = library_item_id
    documents = await StudyMindMap.find(query).sort("-updated_at").limit(50).to_list()
    return [_serialize(document) for document in documents]


@router.patch("/study/mind-maps/{mind_map_id}/nodes/{node_id}")
async def update_mind_map_node(
    mind_map_id: str,
    node_id: str,
    data: MindMapStatusUpdate,
    current_user: User = Depends(get_current_user),
):
    mind_map = await _owned_document(StudyMindMap, mind_map_id, str(current_user.id))
    if not mind_map:
        raise HTTPException(status_code=404, detail="Mind map not found")

    def update_status(node: dict[str, Any]) -> bool:
        if node.get("id") == node_id:
            node["masteryStatus"] = data.mastery_status
            return True
        return any(update_status(child) for child in node.get("children", []))

    if not update_status(mind_map.tree):
        raise HTTPException(status_code=404, detail="Mind map node not found")

    mind_map.updated_at = datetime.now(timezone.utc)
    await mind_map.save()
    return _serialize(mind_map)


@router.get("/manuscripts")
async def list_manuscripts(current_user: User = Depends(get_current_user)):
    documents = await LatexManuscript.find(
        {"user_id": str(current_user.id)}
    ).sort("-updated_at").limit(100).to_list()
    return [
        {
            "id": str(document.id),
            "title": document.title,
            "created_at": document.created_at,
            "updated_at": document.updated_at,
        }
        for document in documents
    ]


@router.get("/manuscripts/{manuscript_id}")
async def get_manuscript(
    manuscript_id: str,
    current_user: User = Depends(get_current_user),
):
    manuscript = await _owned_document(
        LatexManuscript, manuscript_id, str(current_user.id)
    )
    if not manuscript:
        raise HTTPException(status_code=404, detail="Manuscript not found")
    return _serialize(manuscript)


@router.post("/manuscripts", status_code=status.HTTP_201_CREATED)
async def create_manuscript(
    data: ManuscriptCreate,
    current_user: User = Depends(get_current_user),
):
    manuscript = LatexManuscript(user_id=str(current_user.id), **data.model_dump())
    await manuscript.insert()
    return _serialize(manuscript)


@router.patch("/manuscripts/{manuscript_id}")
async def update_manuscript(
    manuscript_id: str,
    data: ManuscriptUpdate,
    current_user: User = Depends(get_current_user),
):
    manuscript = await _owned_document(
        LatexManuscript, manuscript_id, str(current_user.id)
    )
    if not manuscript:
        raise HTTPException(status_code=404, detail="Manuscript not found")

    for key, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(manuscript, key, value)
    manuscript.updated_at = datetime.now(timezone.utc)
    await manuscript.save()
    return _serialize(manuscript)


@router.delete("/manuscripts/{manuscript_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_manuscript(
    manuscript_id: str,
    current_user: User = Depends(get_current_user),
):
    manuscript = await _owned_document(
        LatexManuscript, manuscript_id, str(current_user.id)
    )
    if not manuscript:
        raise HTTPException(status_code=404, detail="Manuscript not found")
    await manuscript.delete()


@router.get(
    "/integrations/kaggle/status",
    dependencies=[Depends(get_current_user)],
)
async def get_kaggle_status():
    configured = bool(settings.kaggle_username and settings.kaggle_api_key)
    return {
        "configured": configured,
        "connected": False,
        "username": settings.kaggle_username if configured else None,
    }


@router.post(
    "/integrations/kaggle/test",
    dependencies=[Depends(get_current_user)],
)
async def test_kaggle_connection():
    if not settings.kaggle_username or not settings.kaggle_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Kaggle credentials are not configured on the server.",
        )

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(
                "https://www.kaggle.com/api/v1/datasets/list",
                auth=(settings.kaggle_username, settings.kaggle_api_key),
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Kaggle could not be reached. Try again later.",
        ) from exc

    if response.status_code in (401, 403):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Kaggle rejected the server-side credentials.",
        )
    if not response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Kaggle connection check failed with HTTP {response.status_code}.",
        )

    return {
        "configured": True,
        "connected": True,
        "username": settings.kaggle_username,
    }
