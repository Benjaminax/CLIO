import React, { useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Search,
  Sparkles,
  Bookmark,
  Star,
  RotateCw,
  Box,
  Compass,
  ChevronRight,
} from "lucide-react";
import { FeatureApiFetch } from "./featureApi";
import { Three3dBookViewer } from "./Three3dBookViewer";

export interface BookItem {
  id: string;
  title: string;
  author: string;
  category: string;
  type: string;
  description: string;
  pages: number;
  publisher?: string;
  year?: number;
  coverTone: "soft" | "dark" | "slides" | "grid";
  progressPercent: number;
  lastPageRead: number;
  isBookmarked: boolean;
  isFavorite: boolean;
  content?: string;
}

const DEFAULT_BOOKS: BookItem[] = [
  {
    id: "book-1",
    title: "Sun Tzu on the Art of War",
    author: "Allandale Online Publishing",
    category: "Strategy & Philosophy",
    type: "PDF",
    description: "An ancient Chinese military treatise attributed to Sun Tzu. Composed of 13 chapters, each devoted to one aspect of warfare, strategy, and calculations.",
    pages: 66,
    publisher: "Clio Press",
    year: 2010,
    coverTone: "soft",
    progressPercent: 12,
    lastPageRead: 8,
    isBookmarked: true,
    isFavorite: true,
  },
  {
    id: "book-2",
    title: "Thor #1 (2014) · Goddess of Thunder",
    author: "Jason Aaron",
    category: "Comic & Graphic Novel",
    type: "PDF",
    description: "The Mjolnir hammer rests on the Moon, and the Odinson is no longer worthy to lift it. A mystery heroine lifts the hammer and becomes the Goddess of Thunder.",
    pages: 26,
    publisher: "Marvel Comics",
    year: 2014,
    coverTone: "dark",
    progressPercent: 35,
    lastPageRead: 9,
    isBookmarked: true,
    isFavorite: false,
  },
  {
    id: "book-3",
    title: "Great Expectations",
    author: "Charles Dickens",
    category: "Classic Literature",
    type: "PDF",
    description: "The story of the orphan Pip, tracing his life from humble blacksmith apprentice in the marshes to an ambitious gentleman in Victorian London.",
    pages: 480,
    publisher: "Chapman & Hall",
    year: 1861,
    coverTone: "soft",
    progressPercent: 50,
    lastPageRead: 240,
    isBookmarked: true,
    isFavorite: true,
  },
  {
    id: "book-4",
    title: "Multimodal Document Parsing Architecture",
    author: "CLIO Platform Research",
    category: "Computer Science",
    type: "PDF",
    description: "Scholarly manuscript detailing joint vision-language transformers for layout parsing, math formula extraction, and verified citation indexing.",
    pages: 18,
    publisher: "Academic City Press",
    year: 2026,
    coverTone: "slides",
    progressPercent: 80,
    lastPageRead: 14,
    isBookmarked: false,
    isFavorite: true,
  },
];

interface Interactive3dLibraryPageProps {
  token?: string | null;
  user?: any;
  apiFetch?: FeatureApiFetch;
  onOpenBook?: (book: BookItem) => void;
  onSignIn?: () => void;
}

export function Interactive3dLibraryPage({
  onOpenBook,
}: Interactive3dLibraryPageProps) {
  const [books, setBooks] = useState<BookItem[]>(DEFAULT_BOOKS);
  const [selectedBookId, setSelectedBookId] = useState<string>("book-1");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState<"all" | "reading" | "favorites" | "bookmarked">("all");

  const [rotY, setRotY] = useState(25);
  const [rotX, setRotX] = useState(-12);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, rotY: 0, rotX: 0 });

  const activeBook = useMemo(
    () => books.find((b) => b.id === selectedBookId) || books[0] || DEFAULT_BOOKS[0],
    [books, selectedBookId]
  );

  const categories = useMemo(() => {
    const set = new Set(books.map((b) => b.category));
    return ["All", ...Array.from(set)];
  }, [books]);

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const matchesSearch =
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = selectedCategory === "All" || book.category === selectedCategory;

      let matchesStatus = true;
      if (filterStatus === "reading") matchesStatus = book.progressPercent > 0;
      if (filterStatus === "favorites") matchesStatus = book.isFavorite;
      if (filterStatus === "bookmarked") matchesStatus = book.isBookmarked;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [books, searchQuery, selectedCategory, filterStatus]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      rotY,
      rotX,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.current.x;
    const deltaY = e.clientY - dragStart.current.y;
    setRotY(dragStart.current.rotY + deltaX * 0.6);
    setRotX(Math.max(-45, Math.min(45, dragStart.current.rotX - deltaY * 0.4)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const toggleBookmark = (id: string) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isBookmarked: !b.isBookmarked } : b))
    );
  };

  const toggleFavorite = (id: string) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isFavorite: !b.isFavorite } : b))
    );
  };

  return (
    <div className="clio-feature-page space-y-6 pb-12 max-w-6xl mx-auto px-4 text-neutral-100">
      {/* Header Banner - Dark Styled */}
      <div className="p-6 rounded-2xl border border-indigo-500/30 bg-neutral-900 space-y-4 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2">
            <Box className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold tracking-tight text-neutral-100">
              Interactive 3D Digital Library
            </h1>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-800/60 bg-indigo-950/80 text-xs font-semibold text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Group 2 · 3D Bookshelf & Spatial Reader
          </span>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed max-w-3xl">
          Browse, inspect, and read digital books in full 3D. Drag to rotate book covers and spines in 360 degrees, inspect book synopses, bookmark reading positions, and launch the document reader.
        </p>
      </div>

      {/* Main 3D Stage & Inspector View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Interactive 3D Showcase */}
        <div className="lg:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-950 p-6 flex flex-col items-center justify-between min-h-[460px] relative overflow-hidden shadow-2xl select-none">
          {/* Top Controls Overlay */}
          <div className="w-full flex items-center justify-between text-xs text-neutral-300 z-10">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-neutral-200">
                3D Spatial Orbit Viewer
              </span>
              <span className="text-[10px] bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded text-neutral-300 font-medium">
                Drag to Rotate 360°
              </span>
            </div>

            <button
              onClick={() => {
                setRotY(25);
                setRotX(-12);
              }}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 flex items-center gap-1 transition-all shadow-sm"
            >
              <RotateCw className="w-3 h-3" /> Reset View
            </button>
          </div>

          {/* 3D WebGL / Three.js Skinned Book Stage */}
          <div className="w-full flex-1 my-4 flex items-center justify-center">
            <Three3dBookViewer
              title={activeBook.title}
              author={activeBook.author}
              description={activeBook.description}
              pagesCount={activeBook.pages}
              coverTone={activeBook.coverTone}
              onOpenReader={() => onOpenBook && onOpenBook(activeBook)}
            />
          </div>

          {/* Interactive 3D Wooden/Modern Shelf Floor */}
          <div className="w-full bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 h-6 rounded-xl border border-neutral-700 shadow-lg flex items-center justify-center text-[10px] text-neutral-300 font-mono font-semibold">
            3D Shelf Surface Level · Interactive Rotation Stage
          </div>
        </div>

        {/* Right Column: Selected Book Details & Actions */}
        <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900 space-y-5 flex flex-col justify-between shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <span className="px-2.5 py-1 rounded-full bg-indigo-950/80 border border-indigo-800 text-indigo-300 text-xs font-semibold">
                {activeBook?.category}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFavorite(activeBook.id)}
                  className="p-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-200 transition-colors"
                  title="Favorite"
                >
                  <Star
                    className="w-4 h-4"
                    fill={activeBook?.isFavorite ? "currentColor" : "none"}
                  />
                </button>
                <button
                  onClick={() => toggleBookmark(activeBook.id)}
                  className="p-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-200 transition-colors"
                  title="Bookmark"
                >
                  <Bookmark
                    className="w-4 h-4"
                    fill={activeBook?.isBookmarked ? "currentColor" : "none"}
                  />
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-neutral-100">{activeBook?.title}</h2>
              <p className="text-xs text-neutral-400 mt-1">{activeBook?.author}</p>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">{activeBook?.description}</p>

            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-400 font-medium">
                <span>Reading Progress:</span>
                <span className="text-neutral-100 font-bold">{activeBook?.progressPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${activeBook?.progressPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-neutral-400">
                Saved Position: Page {activeBook?.lastPageRead} of {activeBook?.pages}
              </p>
            </div>
          </div>

          <button
            onClick={() => onOpenBook && onOpenBook(activeBook)}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            Open & Read Book
          </button>
        </div>
      </div>

      {/* Catalogue Search & Category Filter Bar */}
      <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900 space-y-4 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library catalogue by title, author, or keywords..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            {(["all", "reading", "favorites", "bookmarked"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-xl border capitalize text-xs font-semibold transition-all ${
                  filterStatus === status
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                    : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl border text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-neutral-100 text-neutral-950 border-neutral-100 font-bold"
                  : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Catalogue Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {filteredBooks.map((book) => (
            <div
              key={book.id}
              onClick={() => setSelectedBookId(book.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                selectedBookId === book.id
                  ? "bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-500/10"
                  : "bg-neutral-950 border-neutral-800 hover:border-neutral-700"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span className="font-mono">{book.type}</span>
                  <span>{book.pages} pages</span>
                </div>
                <h3 className="font-bold text-xs text-neutral-100 leading-snug line-clamp-2">
                  {book.title}
                </h3>
                <p className="text-[11px] text-neutral-400 truncate">{book.author}</p>
              </div>

              <div className="pt-3 mt-3 border-t border-neutral-800 flex items-center justify-between text-[11px]">
                <span className="text-neutral-400">{book.progressPercent}% Read</span>
                <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
