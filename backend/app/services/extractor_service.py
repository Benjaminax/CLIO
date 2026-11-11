import os
import logging
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import httpx
import urllib.parse
import re

logger = logging.getLogger("clio.extractor")

class ExtractorService:
    @staticmethod
    def fetch_internet_metadata(title: str, author: str) -> Dict[str, Any]:
        result = {}
        try:
            params = {"title": title, "limit": 5}
            if author and author != "Unknown Author":
                params["author"] = author
            url = f"https://openlibrary.org/search.json?{urllib.parse.urlencode(params)}"
            response = httpx.get(url, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                docs = data.get("docs", [])
                normalized_title = re.sub(r"[^a-z0-9]+", " ", title.casefold()).strip()
                matching_docs = [
                    doc for doc in docs
                    if re.sub(r"[^a-z0-9]+", " ", str(doc.get("title", "")).casefold()).strip()
                    in {normalized_title, f"{normalized_title} illustrated", f"{normalized_title} revised"}
                ]
                if matching_docs:
                    doc = matching_docs[0]
                    result["title"] = doc.get("title")
                    publishers = doc.get("publisher", [])
                    if publishers:
                        result["publisher"] = publishers[0]
                    year = doc.get("first_publish_year")
                    if year:
                        result["publish_year"] = year
                    cover_id = doc.get("cover_i")
                    if cover_id:
                        result["cover_url"] = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"
                    subjects = doc.get("subject", [])
                    if subjects:
                        result["description"] = ", ".join(subjects[:6])
                    if not author or author == "Unknown Author":
                        authors = doc.get("author_name", [])
                        if authors:
                            result["author"] = authors[0]
        except Exception as e:
            logger.warning(f"Internet metadata fetch failed: {e}")
        return result

    @staticmethod
    def parse_chapters_from_pages(pages: List[Tuple[int, str]], default_title: str) -> List[Dict[str, Any]]:
        if not pages:
            return [{
                "id": 1,
                "title": default_title or "Overview",
                "subtitle": "Page 1",
                "pageStart": 1,
                "lead": "Document content.",
                "paragraphs": []
            }]

        chapters = []
        current_chap_title = ""
        current_paragraphs = []
        chap_id = 1

        chapter_regex = re.compile(
            r'^(?:CHAPTER|SECTION|PART|MODULE|UNIT|ACT)\s+(?:\d+|[IVXLCDM]+)(?:\s*[:\-–—]\s*(.+))?|^(?:\d+\.\d*)\s+([A-Z][A-Za-z0-9\s,\-\–—]{3,60})$',
            re.IGNORECASE
        )

        for page_num, text in pages:
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            for line in lines:
                match = chapter_regex.match(line)
                if match and len(line) < 80:
                    if current_paragraphs:
                        chapters.append({
                            "id": chap_id,
                            "title": current_chap_title or f"Page {page_num}",
                            "subtitle": f"Page {page_num}",
                            "pageStart": page_num,
                            "lead": current_paragraphs[0],
                            "paragraphs": current_paragraphs[1:] if len(current_paragraphs) > 1 else current_paragraphs
                        })
                        chap_id += 1
                        current_paragraphs = []
                    current_chap_title = match.group(1) or match.group(2) or line
                elif len(line) > 10:
                    current_paragraphs.append(line)

        if current_paragraphs:
            chapters.append({
                "id": chap_id,
                "title": current_chap_title or (f"Page {pages[-1][0]}" if len(pages) > 1 else default_title),
                "subtitle": f"Page {pages[-1][0]}",
                "pageStart": pages[-1][0],
                "lead": current_paragraphs[0],
                "paragraphs": current_paragraphs[1:] if len(current_paragraphs) > 1 else current_paragraphs
            })

        # If regex didn't find clear headings or if document has multiple pages but collapsed into 1 chapter,
        # generate a rich chapter entry PER PAGE (or pairs of pages) so users can browse all pages!
        if len(chapters) <= 1 and len(pages) > 1:
            chapters = []
            for page_num, page_text in pages:
                lines = [l.strip() for l in page_text.split("\n") if len(l.strip()) > 10]
                first_line = lines[0] if lines else f"Page {page_num}"
                clean_heading = first_line[:60] if len(first_line) > 5 else f"Page {page_num}"
                chapters.append({
                    "id": page_num,
                    "title": f"Page {page_num}: {clean_heading}",
                    "subtitle": f"Page {page_num} of {len(pages)}",
                    "pageStart": page_num,
                    "lead": lines[0] if lines else f"Content on page {page_num}.",
                    "paragraphs": lines[1:] if len(lines) > 1 else (lines if lines else [f"Page {page_num} content."])
                })

        return chapters

    @staticmethod
    def extract_pdf(file_path: str, cover_output_path: Optional[str] = None) -> Dict[str, Any]:
        import fitz  # PyMuPDF
        doc = fitz.open(file_path)
        page_count = len(doc)
        metadata = doc.metadata or {}
        title = metadata.get("title") or Path(file_path).stem.replace("_", " ")
        author = metadata.get("author") or "Unknown Author"

        if cover_output_path and page_count > 0:
            try:
                page0 = doc.load_page(0)
                pix = page0.get_pixmap(dpi=150)
                pix.save(cover_output_path)
            except Exception as e:
                logger.warning(f"Could not render PDF cover: {e}")

        full_text_list = []
        for page_num in range(page_count):
            page = doc.load_page(page_num)
            text = page.get_text()
            if text.strip():
                full_text_list.append((page_num + 1, text.strip()))

        doc.close()

        # Enrich with internet metadata
        net_meta = ExtractorService.fetch_internet_metadata(title, author)
        if net_meta.get("title"):
            title = net_meta["title"]
        if net_meta.get("author"):
            author = net_meta["author"]

        chapters = ExtractorService.parse_chapters_from_pages(full_text_list, title)

        return {
            "title": title,
            "author": author,
            "page_count": page_count,
            "description": net_meta.get("description") or metadata.get("subject") or "",
            "publisher": net_meta.get("publisher"),
            "pages": full_text_list,
            "chapters": chapters,
        }

    @staticmethod
    def extract_epub(file_path: str, cover_output_path: Optional[str] = None) -> Dict[str, Any]:
        import ebooklib
        from ebooklib import epub
        from bs4 import BeautifulSoup

        book = epub.read_epub(file_path)
        title_meta = book.get_metadata("DC", "title")
        title = title_meta[0][0] if title_meta else Path(file_path).stem.replace("_", " ")
        creator_meta = book.get_metadata("DC", "creator")
        author = creator_meta[0][0] if creator_meta else "Unknown Author"
        desc_meta = book.get_metadata("DC", "description")
        description = desc_meta[0][0] if desc_meta else ""

        if cover_output_path:
            try:
                for item in book.get_items_of_type(ebooklib.ITEM_COVER):
                    with open(cover_output_path, "wb") as f:
                        f.write(item.get_content())
                    break
            except Exception as e:
                logger.warning(f"Could not extract EPUB cover: {e}")

        chapters = []
        chap_num = 1
        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            soup = BeautifulSoup(item.get_content(), "html.parser")
            text = soup.get_text().strip()
            if text:
                paras = [p.strip() for p in text.split("\n") if p.strip()]
                chapters.append({
                    "id": chap_num,
                    "title": (soup.find(['h1', 'h2', 'h3']).get_text() if soup.find(['h1', 'h2', 'h3']) else f"Chapter {chap_num}"),
                    "subtitle": f"Section {chap_num}",
                    "pageStart": chap_num,
                    "lead": paras[0] if paras else "",
                    "paragraphs": paras[1:] if len(paras) > 1 else paras
                })
                chap_num += 1

        net_meta = ExtractorService.fetch_internet_metadata(title, author)
        if net_meta.get("publisher"):
            publisher = net_meta["publisher"]
        else:
            publisher = None

        return {
            "title": net_meta.get("title") or title,
            "author": net_meta.get("author") or author,
            "page_count": len(chapters) or 1,
            "description": description or net_meta.get("description") or "",
            "publisher": publisher,
            "pages": [(i+1, c["lead"] + "\n" + "\n".join(c["paragraphs"])) for i, c in enumerate(chapters)],
            "chapters": chapters if chapters else [{
                "id": 1,
                "title": title,
                "subtitle": "Chapter 1",
                "pageStart": 1,
                "lead": description or title,
                "paragraphs": [description] if description else []
            }]
        }

    @staticmethod
    def extract_docx(file_path: str) -> Dict[str, Any]:
        import docx
        doc = docx.Document(file_path)
        title = Path(file_path).stem.replace("_", " ")
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        if paragraphs:
            title = paragraphs[0][:100]

        pages = [(i + 1, p) for i, p in enumerate(paragraphs)]
        chapters = ExtractorService.parse_chapters_from_pages(pages, title)

        return {
            "title": title,
            "author": "You",
            "page_count": max(1, len(paragraphs) // 10),
            "description": "",
            "publisher": None,
            "pages": pages,
            "chapters": chapters,
        }

    @staticmethod
    def extract_pptx(file_path: str) -> Dict[str, Any]:
        from pptx import Presentation
        prs = Presentation(file_path)
        slide_count = len(prs.slides)
        slides_text = []

        title = Path(file_path).stem.replace("_", " ")
        for i, slide in enumerate(prs.slides):
            slide_content = []
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    slide_content.append(shape.text.strip())
            joined = "\n".join(slide_content)
            if i == 0 and joined:
                title = joined.split("\n")[0][:100]
            slides_text.append((i + 1, joined))

        chapters = [{
            "id": i+1,
            "title": f"Slide {i+1}",
            "subtitle": "Presentation Slide",
            "pageStart": i+1,
            "lead": text.split("\n")[0] if text else "",
            "paragraphs": text.split("\n")[1:] if text and "\n" in text else []
        } for i, text in slides_text]

        return {
            "title": title,
            "author": "Speaker",
            "page_count": slide_count,
            "description": f"Presentation with {slide_count} slides",
            "publisher": None,
            "pages": slides_text,
            "chapters": chapters,
        }

    @staticmethod
    def extract_xlsx(file_path: str) -> Dict[str, Any]:
        import openpyxl
        wb = openpyxl.load_workbook(file_path, read_only=True)
        sheet_names = wb.sheetnames
        sheets_data = []

        for name in sheet_names:
            ws = wb[name]
            rows = []
            for row in ws.iter_rows(max_row=50, values_only=True):
                non_empty = [str(cell) for cell in row if cell is not None]
                if non_empty:
                    rows.append(" | ".join(non_empty))
            if rows:
                sheets_data.append((1, f"Sheet: {name}\n" + "\n".join(rows)))

        wb.close()
        chapters = [{
            "id": idx+1,
            "title": f"Sheet: {name}",
            "subtitle": "Spreadsheet",
            "pageStart": 1,
            "lead": content[:200],
            "paragraphs": [content]
        } for idx, (pnum, content) in enumerate(sheets_data)]

        return {
            "title": Path(file_path).stem.replace("_", " "),
            "author": "Data Sheet",
            "page_count": len(sheet_names),
            "description": f"Spreadsheet containing {len(sheet_names)} sheets",
            "publisher": None,
            "pages": sheets_data,
            "chapters": chapters,
        }

    @staticmethod
    def extract_text(file_path: str) -> Dict[str, Any]:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        title = Path(file_path).stem.replace("_", " ")
        lines = [line.strip() for line in content.split("\n") if line.strip()]
        if lines:
            title = lines[0][:100]

        pages = [(1, content)]
        chapters = ExtractorService.parse_chapters_from_pages(pages, title)

        return {
            "title": title,
            "author": "Author",
            "page_count": max(1, len(lines) // 40),
            "description": "",
            "publisher": None,
            "pages": pages,
            "chapters": chapters,
        }

    @classmethod
    def extract_document(
        cls,
        file_path: str,
        file_type: str,
        cover_output_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            if file_type == "PDF":
                return cls.extract_pdf(file_path, cover_output_path)
            elif file_type == "EPUB":
                return cls.extract_epub(file_path, cover_output_path)
            elif file_type == "DOCX":
                return cls.extract_docx(file_path)
            elif file_type == "PPTX":
                return cls.extract_pptx(file_path)
            elif file_type == "XLSX":
                return cls.extract_xlsx(file_path)
            else:
                return cls.extract_text(file_path)
        except Exception as e:
            logger.error(f"Error extracting {file_type} from {file_path}: {e}")
            return {
                "title": Path(file_path).stem.replace("_", " "),
                "author": "Unknown",
                "page_count": 1,
                "description": "",
                "publisher": None,
                "pages": [],
                "chapters": [{
                    "id": 1,
                    "title": Path(file_path).stem.replace("_", " "),
                    "subtitle": "Overview",
                    "pageStart": 1,
                    "lead": "Document content could not be fully parsed.",
                    "paragraphs": []
                }]
            }


extractor_service = ExtractorService()
