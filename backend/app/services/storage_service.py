import os
import uuid
import shutil
import aiofiles
from pathlib import Path
from typing import Optional, Tuple
from fastapi import UploadFile
from app.config import settings
from app.core.exceptions import CLIOException

KNOWN_EXTENSIONS = {
    ".epub": ("EPUB", "application/epub+zip"),
    ".pdf": ("PDF", "application/pdf"),
    ".docx": ("DOCX", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ".doc": ("DOC", "application/msword"),
    ".pptx": ("PPTX", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
    ".ppt": ("PPT", "application/vnd.ms-powerpoint"),
    ".xlsx": ("XLSX", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ".xls": ("XLS", "application/vnd.ms-excel"),
    ".csv": ("CSV", "text/csv"),
    ".txt": ("TXT", "text/plain"),
    ".md": ("Markdown", "text/markdown"),
    ".html": ("HTML", "text/html"),
    ".htm": ("HTML", "text/html"),
    ".json": ("JSON", "application/json"),
    ".rtf": ("RTF", "application/rtf"),
    ".mobi": ("MOBI", "application/x-mobipocket-ebook"),
    ".azw3": ("AZW3", "application/vnd.amazon.ebook"),
}

class StorageService:
    def __init__(self):
        self.base_path = Path(settings.local_storage_path).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_user_dirs(self, user_id: str) -> Tuple[Path, Path]:
        user_dir = self.base_path / "users" / str(user_id)
        original_dir = user_dir / "original"
        covers_dir = user_dir / "covers"
        original_dir.mkdir(parents=True, exist_ok=True)
        covers_dir.mkdir(parents=True, exist_ok=True)
        return original_dir, covers_dir

    def validate_file(self, filename: str, file_size: Optional[int] = None) -> Tuple[str, str, str]:
        ext = Path(filename).suffix.lower()

        if file_size and file_size > settings.max_upload_size_bytes:
            raise CLIOException(
                message=f"File exceeds maximum allowed size of {settings.max_upload_size_mb} MB",
                code="FILE_TOO_LARGE",
                status_code=413,
            )

        if ext in KNOWN_EXTENSIONS:
            file_type, mime_type = KNOWN_EXTENSIONS[ext]
        else:
            # Universal fallback: accept any device file format
            file_type = ext.replace(".", "").upper() if ext else "FILE"
            mime_type = "application/octet-stream"

        return ext, file_type, mime_type

    async def save_upload(self, user_id: str, upload_file: UploadFile) -> Tuple[str, int, str, str]:
        filename = upload_file.filename or "unnamed_document"
        ext, file_type, mime_type = self.validate_file(filename)

        original_dir, _ = self._get_user_dirs(user_id)
        unique_id = uuid.uuid4().hex
        safe_filename = f"{unique_id}_{filename.replace(' ', '_')}"
        dest_path = original_dir / safe_filename

        bytes_written = 0
        async with aiofiles.open(dest_path, "wb") as f:
            while chunk := await upload_file.read(1024 * 1024):  # 1MB chunks
                bytes_written += len(chunk)
                if bytes_written > settings.max_upload_size_bytes:
                    if dest_path.exists():
                        dest_path.unlink()
                    raise CLIOException(
                        message=f"File exceeds {settings.max_upload_size_mb} MB limit",
                        code="FILE_TOO_LARGE",
                        status_code=413,
                    )
                await f.write(chunk)

        return str(dest_path), bytes_written, file_type, mime_type

    def get_cover_path(self, user_id: str, item_id: str) -> Path:
        _, covers_dir = self._get_user_dirs(user_id)
        return covers_dir / f"{item_id}.png"

    def delete_file(self, file_path: Optional[str]):
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass


storage_service = StorageService()


