import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import UploadFile
from app.models.library import LibraryItem, Category, Tag, Collection, CollectionMembership, ProcessingStatus, ReadingStatus
from app.models.reading import ReadingProgress, DocumentContent, DocumentChunk
from app.models.annotations import Annotation, Highlight, Bookmark
from app.schemas.library import (
    LibraryItemCreate, LibraryItemUpdate, LibraryItemResponse,
    AnnotationCreate, HighlightCreate, ProgressUpdate,
    CollectionCreate, CollectionUpdate
)
from app.services.storage_service import storage_service
from app.services.extractor_service import extractor_service

logger = logging.getLogger(__name__)


class LibraryService:
    @staticmethod
    def _to_response(item: LibraryItem) -> LibraryItemResponse:
        return LibraryItemResponse(
            id=str(item.id),
            user_id=item.user_id,
            title=item.title,
            author=item.author,
            description=item.description,
            publisher=item.publisher,
            language=item.language,
            file_name=item.file_name,
            file_type=item.file_type,
            mime_type=item.mime_type,
            file_size=item.file_size,
            cover_image_path=item.cover_image_path,
            category_id=item.category_id,
            tags=item.tags,
            metadata=item.metadata,
            chapters=item.metadata.get("chapters", []) if isinstance(item.metadata, dict) else [],
            page_count=item.page_count,
            processing_status=item.processing_status.value if hasattr(item.processing_status, 'value') else str(item.processing_status),
            reading_status=item.reading_status.value if hasattr(item.reading_status, 'value') else str(item.reading_status),
            reading_progress=item.reading_progress,
            is_favourite=item.is_favourite,
            is_archived=item.is_archived,
            imported_at=item.imported_at,
            last_opened_at=item.last_opened_at,
            updated_at=item.updated_at,
        )

    async def ingest_file(
        self,
        user_id: str,
        file: UploadFile,
        title: Optional[str] = None,
        author: Optional[str] = None,
    ) -> LibraryItemResponse:
        """Process an uploaded document into the user's library."""
        # 1. Save binary file securely
        dest_path, bytes_written, file_type, mime_type = await storage_service.save_upload(user_id, file)

        # 2. Extract metadata and initial text
        filename = file.filename or "Untitled"
        ext = filename.split(".")[-1].lower() if "." in filename else file_type.lower()
        
        # Cover extraction attempt
        import uuid
        cover_path = storage_service.get_cover_path(user_id, uuid.uuid4().hex)
        extracted = extractor_service.extract_document(dest_path, file_type, str(cover_path))

        item_title = title or extracted.get("title") or filename
        item_author = author or extracted.get("author") or "Unknown Author"
        page_count = extracted.get("page_count") or 1
        has_cover = cover_path.exists()

        # 3. Create LibraryItem document
        item = LibraryItem(
            user_id=user_id,
            title=item_title,
            author=item_author,
            description=extracted.get("description"),
            publisher=extracted.get("publisher"),
            file_name=filename,
            file_type=ext,
            mime_type=mime_type,
            file_size=bytes_written,
            storage_path=dest_path,
            cover_image_path=str(cover_path) if has_cover else None,
            page_count=page_count,
            processing_status=ProcessingStatus.COMPLETED,
            reading_status=ReadingStatus.NOT_STARTED,
            metadata={"extracted_title": item_title, "format": file_type, "chapters": extracted.get("chapters", [])},
        )
        await item.insert()

        # 4. Save extracted pages & create chunks for RAG AI
        try:
            pages = extracted.get("pages", [])
            doc_content = DocumentContent(
                user_id=user_id,
                library_item_id=str(item.id),
                extraction_status="completed",
                extraction_method="extractor_service",
                document_metadata={"total_pages": page_count},
            )
            await doc_content.insert()

            # Create chunks from pages
            chunk_idx = 0
            for page_num, page_text in pages[:40]:  # Cap first 40 sections for RAG
                if not page_text or not page_text.strip():
                    continue
                # Split large pages into ~1000 char chunks
                for i in range(0, len(page_text), 1000):
                    sub = page_text[i:i + 1000].strip()
                    if sub:
                        chunk = DocumentChunk(
                            user_id=user_id,
                            library_item_id=str(item.id),
                            chunk_index=chunk_idx,
                            text=sub,
                            source_location=f"Page {page_num}",
                            token_count=len(sub.split()),
                        )
                        await chunk.insert()
                        chunk_idx += 1
        except Exception as e:
            logger.warning(f"Text extraction warning for {file.filename}: {e}")

        # 5. Initialize ReadingProgress
        try:
            progress = ReadingProgress(
                user_id=user_id,
                library_item_id=str(item.id),
                current_page=1,
                total_pages=page_count or 1,
                progress_percentage=0.0
            )
            await progress.insert()
        except Exception as e:
            # Progress is supplementary; the uploaded library item must remain available.
            logger.warning("Unable to initialize reading progress for %s: %s", item.id, e)

        return self._to_response(item)

    async def list_items(
        self,
        user_id: str,
        search: Optional[str] = None,
        file_type: Optional[str] = None,
        reading_status: Optional[str] = None,
        is_favourite: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[LibraryItemResponse]:
        query: Dict[str, Any] = {"user_id": user_id, "is_archived": False}

        if file_type:
            query["file_type"] = file_type.lower()
        if reading_status:
            query["reading_status"] = reading_status
        if is_favourite is not None:
            query["is_favourite"] = is_favourite
        if search:
            query["title"] = {"$regex": search, "$options": "i"}

        items = await LibraryItem.find(query).skip(skip).limit(limit).sort("-imported_at").to_list()
        return [self._to_response(item) for item in items]

    async def get_item(self, user_id: str, item_id: str) -> Optional[LibraryItemResponse]:
        item = await LibraryItem.get(item_id)
        if not item or item.user_id != user_id:
            return None
        return self._to_response(item)

    async def update_item(self, user_id: str, item_id: str, data: LibraryItemUpdate) -> Optional[LibraryItemResponse]:
        item = await LibraryItem.get(item_id)
        if not item or item.user_id != user_id:
            return None

        update_dict = data.model_dump(exclude_unset=True)
        if update_dict:
            update_dict["updated_at"] = datetime.now(timezone.utc)
            for k, v in update_dict.items():
                setattr(item, k, v)
            await item.save()

        return self._to_response(item)

    async def delete_item(self, user_id: str, item_id: str) -> bool:
        item = await LibraryItem.get(item_id)
        if not item or item.user_id != user_id:
            return False

        # Delete physical file
        storage_service.delete_file(item.storage_path)

        # Delete chunks, progress, and annotations
        await DocumentChunk.find({"library_item_id": item_id}).delete()
        await DocumentContent.find({"library_item_id": item_id}).delete()
        await ReadingProgress.find({"library_item_id": item_id}).delete()
        await Annotation.find({"library_item_id": item_id}).delete()
        await Highlight.find({"library_item_id": item_id}).delete()
        await Bookmark.find({"library_item_id": item_id}).delete()
        await CollectionMembership.find({"library_item_id": item_id}).delete()

        await item.delete()
        return True

    # --- READING PROGRESS ---
    async def update_progress(self, user_id: str, item_id: str, update: ProgressUpdate) -> ReadingProgress:
        prog = await ReadingProgress.find_one({"user_id": user_id, "library_item_id": item_id})
        total = update.total_pages or (prog.total_pages if prog else 1)
        pct = (update.current_page / max(total, 1)) * 100.0 if not update.progress_percentage else update.progress_percentage

        if prog:
            prog.current_page = update.current_page
            prog.total_pages = total
            prog.progress_percentage = min(pct, 100.0)
            if update.current_location:
                prog.current_location = update.current_location
            prog.reading_duration_seconds += update.duration_seconds
            prog.last_read_at = datetime.now(timezone.utc)
            await prog.save()
        else:
            prog = ReadingProgress(
                user_id=user_id,
                library_item_id=item_id,
                current_page=update.current_page,
                total_pages=total,
                progress_percentage=min(pct, 100.0),
                current_location=update.current_location,
                reading_duration_seconds=update.duration_seconds,
            )
            await prog.insert()

        # Update LibraryItem reading_status
        item = await LibraryItem.get(item_id)
        if item and item.user_id == user_id:
            item.reading_progress = prog.progress_percentage
            item.last_opened_at = datetime.now(timezone.utc)
            if prog.progress_percentage >= 99.0:
                item.reading_status = ReadingStatus.COMPLETED
            elif prog.progress_percentage > 0.0:
                item.reading_status = ReadingStatus.IN_PROGRESS
            await item.save()

        return prog

    # --- ANNOTATIONS / NOTES ---
    async def add_annotation(self, user_id: str, item_id: str, note: AnnotationCreate) -> Annotation:
        annot = Annotation(
            user_id=user_id,
            library_item_id=item_id,
            content=note.content,
            location=note.location,
            page_number=note.page_number,
            annotation_type=note.annotation_type,
        )
        await annot.insert()
        return annot

    async def list_annotations(self, user_id: str, item_id: str) -> List[Annotation]:
        return await Annotation.find({
            "user_id": user_id,
            "library_item_id": item_id
        }).sort("-created_at").to_list()

    async def delete_annotation(self, user_id: str, annotation_id: str) -> bool:
        annot = await Annotation.get(annotation_id)
        if not annot or annot.user_id != user_id:
            return False
        await annot.delete()
        return True


library_service = LibraryService()
