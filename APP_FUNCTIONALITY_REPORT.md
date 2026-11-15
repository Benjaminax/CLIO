# CLIO App Functionality Report

**Prepared:** November 15, 2026  
**Purpose:** Plain-language description of CLIO’s user-facing features and current operating requirements.

## Overview

CLIO is a digital reading and study workspace. It brings books and documents into one library, provides reading and annotation tools, and offers ways to turn document content into answers, study materials, and visual concept maps.

## What users can do

### Accounts and workspace
- Create an account, sign in, sign out, and use password recovery.
- Manage profile and reading preferences.
- Use a local/device workspace for supported features when working offline; queue some changes for later synchronization.

### Library and reading
- Import books and documents, browse the library, and search, filter, or sort saved items.
- Organize items with favorites, pins, tags, and collections.
- Read documents with navigation, progress tracking, bookmarks, highlights, notes, text search, and adjustable reading appearance.
- Use text-to-speech where the device/browser supports it.
- Discover books through the book-discovery screen.

The import screen advertises PDF, EPUB, DOCX, PPTX, XLSX, TXT, Markdown, HTML, CSV, JSON, XML, RTF, and common source-code formats. Successful reading or text extraction depends on the format and the configured extraction services.

### AI and study tools
- Ask questions about library materials; connected responses can include source references.
- Generate or view mind maps that organize a document’s key points and concepts.
- Create, edit, and review flashcards associated with library documents.
- Use reader AI actions such as explaining or summarizing selected material and preparing study content.
- Explore concepts and connections in the knowledge graph.

AI and other cloud-backed operations require a reachable, configured backend. Results depend on the document text being available and extractable.

### Research and writing
- Upload or paste manuscript text for citation and inline-reference checks. These are automated findings to review, not a guarantee that a citation is correct or incorrect.
- Edit and manage LaTeX manuscripts, request server-side PDF compilation, and download the compiled PDF when compilation succeeds.

LaTeX compilation requires the backend and a configured TeX engine.

### File and progress utilities
- Convert supported text-based files among PDF, DOCX, EPUB, TXT, HTML, and Markdown.
- Inspect PDFs and extract text or selected page ranges.
- View and reopen downloaded files.
- Review reading activity, goals, progress, and reading reports.
- Configure sync, reading appearance, AI context preferences, and the API address; access help and support.

## Main areas in the app

The navigation includes Overview, My Library, Discover Books, Collections, Ask Your Library, Study Workspace, AI Mind Map, Citation Checker, LaTeX & PDF Viewer, Kaggle Integration, Highlights, Reading Memory, Knowledge Graph, File Converter, Downloaded Files, PDF Toolkit, Reading Dashboard/Reading Analytics, Profile, Settings, and Help and Support.

Some entries are alternate views rather than separate tools: Books, Documents, and Presentations filter the library; Reading Memory shares the Highlights view; Reading Analytics and Reading Dashboard share the reading dashboard.

## Current readiness and limitations

- During this review, the shared browser preview showed a library API connection error. Cloud library loading, account synchronization, and backend-dependent AI features should not be presented as currently verified in that preview until the backend is available.
- The Kaggle Integration screen currently uses simulated connection and publishing states. It should be described as a prototype interface, not as a working Kaggle publishing integration.
- LaTeX-to-PDF is designed to use server-side compilation, but actual compilation requires a running backend with a TeX engine.
- File import and conversion depend on supported formats, readable document contents, and the available processing services.

## Short description for a presentation

> CLIO is a reading and study platform that helps people collect and organize documents, read and annotate them, ask questions about their materials, and turn what they read into study aids such as flashcards and mind maps. It also includes citation, LaTeX, PDF, file-conversion, and reading-progress tools. Some connected features require CLIO’s backend to be running.
