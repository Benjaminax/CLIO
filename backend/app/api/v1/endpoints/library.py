from pathlib import Path
from bson import ObjectId
from fastapi import APIRouter, Depends, UploadFile, File, Form, Query, HTTPException, status
from fastapi.responses import FileResponse
from typing import List, Optional
from app.dependencies import get_current_user
from app.models.library import LibraryItem
from app.models.user import User
from app.schemas.library import (
    LibraryItemResponse, LibraryItemUpdate, ProgressUpdate,
    AnnotationCreate, AnnotationResponse
)
from app.services.library_service import library_service

router = APIRouter()


@router.post("/upload", response_model=LibraryItemResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    author: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
):
    """Upload a document (PDF, EPUB, DOCX, PPTX, XLSX, TXT) to the user's library."""
    return await library_service.ingest_file(
        user_id=str(current_user.id),
        file=file,
        title=title,
        author=author,
    )


@router.get("", response_model=List[LibraryItemResponse])
async def list_library_items(
    search: Optional[str] = Query(None, description="Search by title or content"),
    file_type: Optional[str] = Query(None, description="Filter by file type (e.g. pdf, epub)"),
    reading_status: Optional[str] = Query(None, description="Filter by reading status"),
    is_favourite: Optional[bool] = Query(None, description="Filter favorites"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all library items for the authenticated user."""
    return await library_service.list_items(
        user_id=str(current_user.id),
        search=search,
        file_type=file_type,
        reading_status=reading_status,
        is_favourite=is_favourite,
        skip=skip,
        limit=limit,
    )


@router.get("/{item_id}", response_model=LibraryItemResponse)
async def get_library_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
):
    """Retrieve details for a single library item."""
    item = await library_service.get_item(str(current_user.id), item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return item


@router.get("/{item_id}/file")
async def get_library_file(
    item_id: str,
    current_user: User = Depends(get_current_user),
):
    """Stream the original document to the authenticated owner."""
    item = await LibraryItem.get(item_id)
    if not item or item.user_id != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    file_path = Path(item.storage_path)
    if not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original document file not found")

    return FileResponse(
        file_path,
        media_type=item.mime_type,
        filename=item.file_name,
    )


@router.patch("/{item_id}", response_model=LibraryItemResponse)
async def update_library_item(
    item_id: str,
    data: LibraryItemUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update title, author, reading progress, favorite status, or tags."""
    item = await library_service.update_item(str(current_user.id), item_id, data)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_library_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a library item and its associated files and annotations."""
    success = await library_service.delete_item(str(current_user.id), item_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return None


# --- READING PROGRESS ---
@router.post("/{item_id}/progress")
async def update_reading_progress(
    item_id: str,
    update: ProgressUpdate,
    current_user: User = Depends(get_current_user),
):
    """Record reading progress (current page, duration, percent complete)."""
    try:
        item = await LibraryItem.get(item_id)
    except (TypeError, ValueError):
        item = None
    if not item or item.user_id != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return await library_service.update_progress(str(current_user.id), item_id, update)


# --- NOTES & ANNOTATIONS ---
@router.get("/{item_id}/notes", response_model=List[AnnotationResponse])
async def list_notes(
    item_id: str,
    current_user: User = Depends(get_current_user),
):
    """List all notes and annotations for a document."""
    try:
        item = await LibraryItem.get(ObjectId(item_id))
    except (TypeError, ValueError):
        item = None
    if not item or item.user_id != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    notes = await library_service.list_annotations(str(current_user.id), item_id)
    return [
        AnnotationResponse(
            id=str(n.id),
            user_id=n.user_id,
            library_item_id=n.library_item_id,
            content=n.content,
            location=n.location,
            page_number=n.page_number,
            annotation_type=n.annotation_type,
            created_at=n.created_at,
            updated_at=n.updated_at,
        )
        for n in notes
    ]


@router.post("/{item_id}/notes", response_model=AnnotationResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    item_id: str,
    note: AnnotationCreate,
    current_user: User = Depends(get_current_user),
):
    """Add a note or annotation to a document."""
    try:
        item = await LibraryItem.get(ObjectId(item_id))
    except (TypeError, ValueError):
        item = None
    if not item or item.user_id != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    n = await library_service.add_annotation(str(current_user.id), item_id, note)
    return AnnotationResponse(
        id=str(n.id),
        user_id=n.user_id,
        library_item_id=n.library_item_id,
        content=n.content,
        location=n.location,
        page_number=n.page_number,
        annotation_type=n.annotation_type,
        created_at=n.created_at,
        updated_at=n.updated_at,
    )


@router.delete("/notes/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    annotation_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a note or annotation."""
    success = await library_service.delete_annotation(str(current_user.id), annotation_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return None
