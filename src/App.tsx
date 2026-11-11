import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import type * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import {
  Activity,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Bookmark,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  Compass,
  Download,
  ExternalLink,
  Eye,
  File,
  FileArchive,
  FileChartColumn,
  FileText,
  Folder,
  FolderPlus,
  Grid2X2,
  Highlighter,
  Home,
  Import,
  Library,
  List,
  Loader2,
  LogIn,
  LogOut,
  Maximize2,
  Menu,
  MessageSquareText,
  Minus,
  MoreHorizontal,
  Moon,
  Network,
  PanelLeftClose,
  PanelRight,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  Share2,
  Sliders,
  Sun,
  Star,
  Trash2,
  Type,
  Target,
  Upload,
  User,
  Camera,
  AtSign,
  Mail,
  ShieldCheck,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";

// ─── Hugeicons wrapper ───────────────────────────────────────────────────────
function Sparkles({
  size = 18,
  className = "",
  color = "currentColor",
}: {
  size?: number | string;
  className?: string;
  color?: string;
  [key: string]: any;
}) {
  return (
    <HugeiconsIcon
      icon={SparklesIcon}
      size={size}
      className={className}
      color={color}
      strokeWidth={1.65}
    />
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────
type Page =
  | "Overview"
  | "My Library"
  | "Discover Books"
  | "Books"
  | "Documents"
  | "Presentations"
  | "Collections"
  | "Ask Your Library"
  | "Knowledge Graph"
  | "Study Workspace"
  | "Highlights"
  | "Reading Memory"
  | "File Converter"
  | "Downloaded Files"
  | "PDF Toolkit"
  | "Reading Analytics"
  | "Reading Dashboard"
  | "Profile"
  | "Settings"
  | "Help and Support";

interface User {
  id: string;
  email: string;
  full_name?: string;
  username?: string;
  avatar_url?: string;
}

interface LibraryItem {
  id: string;
  title: string;
  author: string;
  type: string;
  progress: number;
  tone: string;
  mark: string;
  fileSize?: string;
  uploadedAt?: string;
  chapters?: Chapter[];
  content?: string;
  metadata?: BookMetadata & { chapters?: Chapter[] };
  file_path?: string;
  created_at?: string;
  reading_progress?: number;
  pdfPageCount?: number;
  collectionName?: string;
  is_favourite?: boolean;
  tags?: string[];
  language?: string;
}

interface OpenLibraryBook {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  edition_count?: number;
  subject?: string[];
}

interface OpenLibrarySearchResponse {
  numFound?: number;
  num_found?: number;
  docs: OpenLibraryBook[];
}

interface BookMetadata {
  title?: string;
  author?: string;
  publisher?: string;
  publish_year?: number;
  description?: string;
  cover_url?: string;
}

interface Chapter {
  id: number;
  title: string;
  subtitle?: string;
  pageStart?: number;
  lead: string;
  paragraphs: string[];
}

interface Note {
  id: string;
  chapterId: number;
  text: string;
  page: number;
  createdAt: string;
  isHighlight: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: { title: string; chunk?: string }[];
  timestamp: Date;
}

// ─── API client ──────────────────────────────────────────────────────────────
const isAndroidApp = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
function normalizeApiOrigin(value: string): string {
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/, "");
}
const configuredApi = normalizeApiOrigin(import.meta.env.VITE_API_URL || "");
const configuredAndroidApi = normalizeApiOrigin(import.meta.env.VITE_ANDROID_API_URL || "");
const apiBaseStorageKey = "clio_api_url";
function getApiBases(): string[] {
  const savedApi = normalizeApiOrigin(localStorage.getItem(apiBaseStorageKey) || "");
  return [
    savedApi,
    configuredApi,
    configuredAndroidApi,
    ...(isAndroidApp ? ["http://10.0.2.2:8000"] : ["http://localhost:8000"]),
  ]
    .filter(Boolean)
    .map((base) => `${base}/api/v1`)
    .filter((base, index, all) => all.indexOf(base) === index);
}
const API = getApiBases()[0] || "http://localhost:8000/api/v1";
async function checkApiHealth(base: string): Promise<{ database?: string; detail?: string }> {
  const response = await fetch(`${base.replace(/\/api\/v1$/, "")}/health`);
  const health = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(health.detail || "Backend unavailable");
  return health;
}
interface SystemBarAppearancePlugin {
  setColor(options: { color: string }): Promise<void>;
}
interface DownloadedFile {
  id: string;
  name: string;
  mimeType: string;
  path: string;
  size: number;
  modifiedAt: number;
}
interface DownloadedFilesPlugin {
  saveFile(options: { name: string; mimeType: string; data: string }): Promise<DownloadedFile>;
  listFiles(): Promise<{ files: DownloadedFile[] }>;
  readFile(options: { id: string }): Promise<{ data: string; mimeType: string }>;
  openFile(options: { id: string }): Promise<void>;
  deleteFile(options: { id: string }): Promise<void>;
}
const SystemBarAppearance = registerPlugin<SystemBarAppearancePlugin>("SystemBarAppearance");
const DownloadedFiles = registerPlugin<DownloadedFilesPlugin>("DownloadedFiles");

async function loadPdfJs() {
  const library = await import("pdfjs-dist/legacy/build/pdf.mjs");
  library.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  return library;
}

let thumbnailDocumentCache: {
  itemId: string;
  document: Promise<pdfjsLib.PDFDocumentProxy>;
} | null = null;

async function getThumbnailDocument(item: LibraryItem, token: string | null) {
  if (thumbnailDocumentCache?.itemId === item.id) return thumbnailDocumentCache.document;
  const document = (async () => {
    let blob = await getLocalPdf(item.id);
    if (!blob && token && !token.startsWith("local-token-")) {
      const response = await fetch(`${API}/library/${encodeURIComponent(item.id)}/file`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Unable to load PDF thumbnails (${response.status})`);
      blob = await response.blob();
    }
    if (!blob) throw new Error("The PDF is not available offline.");
    const pdfjs = await loadPdfJs();
    return pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
  })();
  thumbnailDocumentCache = { itemId: item.id, document };
  try {
    return await document;
  } catch (error) {
    if (thumbnailDocumentCache?.itemId === item.id) thumbnailDocumentCache = null;
    throw error;
  }
}

function openPdfStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("clio-files", 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("pdfs")) database.createObjectStore("pdfs");
      if (!database.objectStoreNames.contains("downloads")) database.createObjectStore("downloads");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open local PDF storage"));
  });
}

interface BrowserDownloadedFile extends DownloadedFile {
  blob: Blob;
}

async function saveDownloadedFile(blob: Blob, name: string): Promise<DownloadedFile> {
  const existingFiles = await getDownloadedFiles();
  const existingFile = existingFiles.find(
    (file) => file.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  );
  if (existingFile) await deleteDownloadedFile(existingFile);

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return DownloadedFiles.saveFile({
      name,
      mimeType: blob.type || "application/octet-stream",
      data: btoa(binary),
    });
  }

  const record: BrowserDownloadedFile = {
    id: crypto.randomUUID(),
    name,
    mimeType: blob.type || "application/octet-stream",
    path: `CLIO Downloads/${name}`,
    size: blob.size,
    modifiedAt: Date.now(),
    blob,
  };
  const db = await openPdfStore();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("downloads", "readwrite");
    transaction.objectStore("downloads").put(record, record.id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error("Unable to save the downloaded file"));
    transaction.onabort = () =>
      reject(transaction.error || new Error("Saving the downloaded file was aborted"));
  });
  db.close();
  return record;
}

async function getDownloadedFiles(): Promise<DownloadedFile[]> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    const result = await DownloadedFiles.listFiles();
    return result.files;
  }

  const db = await openPdfStore();
  const records = await new Promise<BrowserDownloadedFile[]>((resolve, reject) => {
    const request = db.transaction("downloads", "readonly").objectStore("downloads").getAll();
    request.onsuccess = () => resolve(request.result as BrowserDownloadedFile[]);
    request.onerror = () => reject(request.error || new Error("Unable to list downloaded files"));
  });
  db.close();
  return records
    .sort((left, right) => right.modifiedAt - left.modifiedAt)
    .map(({ blob: _blob, ...record }) => record);
}

async function openDownloadedFile(file: DownloadedFile): Promise<void> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    await DownloadedFiles.openFile({ id: file.id });
  }
}

async function getDownloadedFileBlob(file: DownloadedFile): Promise<Blob> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    const result = await DownloadedFiles.readFile({ id: file.id });
    const binary = atob(result.data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: result.mimeType || file.mimeType });
  }

  const db = await openPdfStore();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const request = db.transaction("downloads", "readonly").objectStore("downloads").get(file.id);
    request.onsuccess = () =>
      resolve((request.result as BrowserDownloadedFile | undefined)?.blob || null);
    request.onerror = () =>
      reject(request.error || new Error("Unable to read the downloaded file"));
  });
  db.close();
  if (!blob) throw new Error("This downloaded file is no longer available.");
  return blob;
}

async function deleteDownloadedFile(file: DownloadedFile): Promise<void> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    await DownloadedFiles.deleteFile({ id: file.id });
    return;
  }

  const db = await openPdfStore();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("downloads", "readwrite");
    transaction.objectStore("downloads").delete(file.id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error("Unable to delete downloaded file"));
  });
  db.close();
}

async function saveLocalPdf(id: string, file: File): Promise<void> {
  const db = await openPdfStore();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("pdfs", "readwrite");
    transaction.objectStore("pdfs").put(file, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error("Unable to save the PDF locally"));
    transaction.onabort = () =>
      reject(transaction.error || new Error("Saving the PDF locally was aborted"));
  });
  db.close();
}

async function getLocalPdf(id: string): Promise<Blob | null> {
  const db = await openPdfStore();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const request = db.transaction("pdfs", "readonly").objectStore("pdfs").get(id);
    request.onsuccess = () => resolve((request.result as Blob | undefined) || null);
    request.onerror = () =>
      reject(request.error || new Error("Unable to read the locally saved PDF"));
  });
  db.close();
  return result;
}

async function removeLocalPdf(id: string): Promise<void> {
  const db = await openPdfStore();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("pdfs", "readwrite");
    transaction.objectStore("pdfs").delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error("Unable to remove the locally saved PDF"));
    transaction.onabort = () =>
      reject(transaction.error || new Error("Removing the locally saved PDF was aborted"));
  });
  db.close();
}

function PdfPageCanvas({
  pdf,
  pageNumber,
  viewportRef,
  zoom,
}: {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const incomingCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderedPageRef = useRef(0);
  const pendingPageRef = useRef(0);
  const renderGenerationRef = useRef(0);
  const [turnDirection, setTurnDirection] = useState<"forward" | "backward">("forward");
  const [isTurning, setIsTurning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | undefined;

    const renderPage = () => {
      const generation = ++renderGenerationRef.current;
      renderTask?.cancel();
      renderTask = undefined;
      setIsTurning(false);

      const render = async () => {
        const container = viewportRef.current;
        const currentCanvas = canvasRef.current;
        const incomingCanvas = incomingCanvasRef.current;
        const pageElement = pageRef.current;
        if (!container || !currentCanvas || !incomingCanvas || !pageElement) return;
        const page = await pdf.getPage(pageNumber);
        if (
          cancelled ||
          generation !== renderGenerationRef.current ||
          !canvasRef.current ||
          !incomingCanvasRef.current ||
          !pageRef.current
        )
          return;
        const baseViewport = page.getViewport({ scale: 1 });
        const styles = window.getComputedStyle(container);
        const availableWidth = Math.min(
          850,
          container.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight),
        );
        const availableHeight =
          container.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
        if (availableWidth <= 0 || availableHeight <= 0) return;
        const viewport = page.getViewport({
          scale:
            Math.min(
              availableWidth / baseViewport.width,
              availableHeight / baseViewport.height,
              2,
            ) * zoom,
        });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        pageElement.style.width = `${Math.floor(viewport.width)}px`;
        pageElement.style.height = `${Math.floor(viewport.height)}px`;
        const targetCanvas =
          renderedPageRef.current === 0 || pageNumber === renderedPageRef.current
            ? currentCanvas
            : incomingCanvas;
        targetCanvas.width = Math.floor(viewport.width * outputScale);
        targetCanvas.height = Math.floor(viewport.height * outputScale);
        targetCanvas.style.width = `${Math.floor(viewport.width)}px`;
        targetCanvas.style.height = `${Math.floor(viewport.height)}px`;
        const task = page.render({
          canvas: targetCanvas,
          canvasContext: targetCanvas.getContext("2d")!,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        });
        renderTask = task;
        try {
          await task.promise;
        } catch (error) {
          if (
            !cancelled &&
            generation === renderGenerationRef.current &&
            (error as Error).name !== "RenderingCancelledException"
          ) {
            console.error(`Unable to render PDF page ${pageNumber}`, error);
          }
          return;
        }
        if (cancelled || generation !== renderGenerationRef.current) return;
        if (targetCanvas === currentCanvas) {
          renderedPageRef.current = pageNumber;
          return;
        }

        pendingPageRef.current = pageNumber;
        setTurnDirection(pageNumber > renderedPageRef.current ? "forward" : "backward");
        requestAnimationFrame(() => {
          if (!cancelled && generation === renderGenerationRef.current) setIsTurning(true);
        });
      };

      render().catch((error: unknown) => {
        if (!cancelled && generation === renderGenerationRef.current) {
          console.error(`Unable to render PDF page ${pageNumber}`, error);
        }
      });
    };

    const container = viewportRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(renderPage);
    resizeObserver.observe(container);
    renderPage();

    return () => {
      cancelled = true;
      renderGenerationRef.current += 1;
      resizeObserver.disconnect();
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, viewportRef, zoom]);

  const finishPageTurn = (event: React.AnimationEvent<HTMLCanvasElement>) => {
    if (
      event.target !== event.currentTarget ||
      !["pdf-page-in-forward", "pdf-page-in-backward"].includes(event.animationName)
    )
      return;
    const currentCanvas = canvasRef.current;
    const incomingCanvas = incomingCanvasRef.current;
    if (!currentCanvas || !incomingCanvas) return;
    currentCanvas.width = incomingCanvas.width;
    currentCanvas.height = incomingCanvas.height;
    currentCanvas.style.width = incomingCanvas.style.width;
    currentCanvas.style.height = incomingCanvas.style.height;
    currentCanvas.getContext("2d")?.drawImage(incomingCanvas, 0, 0);
    renderedPageRef.current = pendingPageRef.current;
    setIsTurning(false);
  };

  return (
    <div
      ref={pageRef}
      className={`pdf-page${isTurning ? ` is-turning-${turnDirection}` : ""}`}
      data-pdf-page={pageNumber}
      aria-label={`PDF page ${pageNumber}`}
    >
      <canvas ref={canvasRef} className="pdf-page-current" />
      <canvas
        ref={incomingCanvasRef}
        className={`pdf-page-incoming${isTurning ? ` is-entering-${turnDirection}` : ""}`}
        onAnimationEnd={finishPageTurn}
        aria-hidden="true"
      />
    </div>
  );
}

function PdfDocumentView({
  item,
  token,
  pageRef,
  onPageCount,
  pageNumber,
  fallbackChapters,
  zoom,
}: {
  item: LibraryItem;
  token: string | null;
  pageRef: React.RefObject<HTMLDivElement | null>;
  onPageCount: (count: number) => void;
  pageNumber: number;
  fallbackChapters?: Chapter[];
  zoom: number;
}) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useFallbackText, setUseFallbackText] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | undefined;

    const loadPdf = async () => {
      setError(null);
      setPdf(null);
      setUseFallbackText(false);

      let blob: Blob | null = null;
      try {
        blob = await getLocalPdf(item.id);
      } catch (storageError) {
        if (!token) console.warn("Local PDF read notice:", storageError);
      }

      if (!blob && token && !item.id.startsWith("local-")) {
        try {
          const response = await fetch(`${API}/library/${item.id}/file`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            blob = await response.blob();
            // Cache locally for offline APK support
            await saveLocalPdf(item.id, blob as File).catch(() => {});
          }
        } catch (fetchErr) {
          console.warn("Could not fetch remote PDF file:", fetchErr);
        }
      }

      if (!blob) {
        if (fallbackChapters && fallbackChapters.length > 0) {
          setUseFallbackText(true);
          onPageCount(fallbackChapters.length);
          return;
        }
        throw new Error(
          "The original PDF is unavailable. Please re-import the file to read its pages.",
        );
      }

      try {
        const pdfjsLib = await loadPdfJs();
        loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(await blob.arrayBuffer()),
          useSystemFonts: true,
        });
        const document = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy();
          return;
        }
        setPdf(document);
        onPageCount(document.numPages);
      } catch (renderError) {
        console.warn("PDF.js render init fallback to text:", renderError);
        if (fallbackChapters && fallbackChapters.length > 0) {
          setUseFallbackText(true);
          onPageCount(fallbackChapters.length);
        } else {
          throw renderError;
        }
      }
    };

    loadPdf().catch((loadError: unknown) => {
      if (!cancelled) {
        if (fallbackChapters && fallbackChapters.length > 0) {
          setUseFallbackText(true);
          onPageCount(fallbackChapters.length);
        } else {
          setError(loadError instanceof Error ? loadError.message : "Unable to open this PDF.");
        }
      }
    });

    return () => {
      cancelled = true;
      loadingTask?.destroy().catch(() => {});
    };
  }, [item.id, token, onPageCount, fallbackChapters]);

  if (useFallbackText && fallbackChapters && fallbackChapters.length > 0) {
    const safeIdx = Math.max(0, Math.min(pageNumber - 1, fallbackChapters.length - 1));
    const currentChapter = fallbackChapters[safeIdx];
    return (
      <div
        className="pdf-text-fallback-wrapper"
        style={{
          padding: "28px 24px",
          maxWidth: 760,
          margin: "0 auto",
          width: "100%",
          background: "transparent",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            paddingBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#888",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Page {pageNumber} of {fallbackChapters.length} · Text View
          </span>
          <span
            style={{
              fontSize: 10,
              background: "rgba(0,0,0,0.06)",
              padding: "2px 8px",
              borderRadius: 4,
              color: "#555",
            }}
          >
            Reflowable
          </span>
        </div>
        <h2 style={{ fontSize: 22, marginBottom: 12, lineHeight: 1.3 }}>{currentChapter.title}</h2>
        {currentChapter.subtitle && (
          <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>{currentChapter.subtitle}</p>
        )}
        {currentChapter.lead && (
          <p style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.6, marginBottom: 16 }}>
            {currentChapter.lead}
          </p>
        )}
        {(currentChapter.paragraphs || []).map((para, i) => (
          <p key={i} style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 14 }}>
            {para}
          </p>
        ))}
      </div>
    );
  }

  if (error)
    return (
      <div className="pdf-message" role="alert">
        {error}
      </div>
    );
  if (!pdf)
    return (
      <div className="pdf-message">
        <Loader2 className="spin" size={18} /> Loading original PDF…
      </div>
    );

  return (
    <div className="pdf-pages">
      <PdfPageCanvas pdf={pdf} pageNumber={pageNumber} viewportRef={pageRef} zoom={zoom} />
    </div>
  );
}

async function apiFetch(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<any> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (token?.startsWith("local-token-")) delete headers["Authorization"];
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  let res: Response | null = null;
  let activeBase = API;
  let lastNetworkError: unknown = null;
  const requestBases = getApiBases();
  for (const base of requestBases) {
    try {
      res = await fetch(`${base}${path}`, { ...options, headers });
      activeBase = base;
      break;
    } catch (networkError) {
      lastNetworkError = networkError;
    }
  }
  if (!res) {
    const detail =
      lastNetworkError instanceof Error
        ? lastNetworkError.message
        : "The API server is unreachable.";
    throw new Error(
      `Unable to connect to CLIO API. Start the backend or set VITE_API_URL. (${detail})`,
    );
  }
  if (
    res.status === 401 &&
    token &&
    !token.startsWith("local-token-") &&
    path !== "/auth/refresh"
  ) {
    const refreshResponse = await fetch(`${activeBase}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshResponse.ok) {
      const refreshPayload = await refreshResponse.json();
      const refreshedToken = refreshPayload.data?.access_token || refreshPayload.access_token;
      if (refreshedToken) {
        localStorage.setItem("clio_token", refreshedToken);
        headers["Authorization"] = `Bearer ${refreshedToken}`;
        res = await fetch(`${activeBase}${path}`, { ...options, headers });
      }
    }
  }
  if (!res.ok) {
    const errorResponse = await res.json().catch(() => null);
    const validationErrors = errorResponse?.error?.details?.errors;
    const message = Array.isArray(validationErrors)
      ? validationErrors
          .map((error: { field?: string; message?: string }) =>
            [error.field, error.message].filter(Boolean).join(": "),
          )
          .join(". ")
      : typeof errorResponse?.detail === "string"
        ? errorResponse.detail
        : typeof errorResponse?.message === "string"
          ? errorResponse.message
          : `HTTP ${res.status}${res.statusText ? `: ${res.statusText}` : ""}`;
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

type PendingSyncAction = {
  id: string;
  itemId: string;
  path: string;
  method: "POST" | "PATCH" | "DELETE";
  body?: string;
  localNoteId?: string;
  queuedAt: string;
};

function readPendingSyncActions(): PendingSyncAction[] {
  try {
    const saved = JSON.parse(localStorage.getItem("clio_pending_sync") || "[]");
    return Array.isArray(saved)
      ? saved.filter(
          (action) =>
            action &&
            typeof action.id === "string" &&
            typeof action.path === "string" &&
            (action.method === "POST" || action.method === "PATCH" || action.method === "DELETE"),
        )
      : [];
  } catch (error) {
    console.error("Unable to read pending offline changes:", error);
    return [];
  }
}

function savePendingSyncActions(actions: PendingSyncAction[]) {
  try {
    localStorage.setItem("clio_pending_sync", JSON.stringify(actions));
  } catch (error) {
    console.error("Unable to save pending offline changes:", error);
    throw error;
  }
}

function queueOfflineSyncAction(action: Omit<PendingSyncAction, "id" | "queuedAt">) {
  const pending = readPendingSyncActions();
  const sameAction = pending.findIndex(
    (entry) => entry.path === action.path && entry.method === action.method,
  );
  const next = {
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    queuedAt: new Date().toISOString(),
  };
  if (sameAction >= 0) pending[sameAction] = next;
  else pending.push(next);
  savePendingSyncActions(pending);
}

// ─── Utility helpers ──────────────────────────────────────────────────────────
function greetingFor(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function detectCollectionName(file: File, category: string): string {
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || "";
  const pathParts = path.split("/").filter(Boolean);
  if (pathParts.length > 1 && pathParts[pathParts.length - 2]) {
    return pathParts[pathParts.length - 2].replace(/[-_]+/g, " ").trim();
  }
  return category;
}

function HomeDownloadsPreview({ onOpenDownloads }: { onOpenDownloads: () => void }) {
  const [files, setFiles] = useState<DownloadedFile[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getDownloadedFiles()
      .then(setFiles)
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load downloads.");
      });
  }, []);

  return (
    <section className="section home-downloads">
      <details>
        <summary>
          <span>
            <span className="eyebrow">RECENT DOWNLOADS</span>
            <strong>
              {files.length
                ? `${files.length} saved file${files.length === 1 ? "" : "s"}`
                : "Your downloaded files"}
            </strong>
          </span>
          <ChevronDown size={18} />
        </summary>
        <div className="home-downloads-content">
          {error ? (
            <p className="conversion-error" role="alert">
              {error}
            </p>
          ) : files.length === 0 ? (
            <p className="home-downloads-empty">
              Files you save from the converter will appear here.
            </p>
          ) : (
            <div className="home-download-list">
              {files.slice(0, 3).map((file) => (
                <div className="home-download-item" key={file.id}>
                  <FileText size={17} />
                  <span>
                    <b>{file.name}</b>
                    <small>{formatBytes(file.size)}</small>
                  </span>
                </div>
              ))}
            </div>
          )}
          <button className="secondary" type="button" onClick={onOpenDownloads}>
            Open downloaded files <ArrowRight size={15} />
          </button>
        </div>
      </details>
    </section>
  );
}

function toneForType(ext: string): string {
  const e = ext.toUpperCase();
  if (e === "PDF") return "soft";
  if (["EPUB", "MOBI"].includes(e)) return "dark";
  if (["PPTX", "PPT"].includes(e)) return "slides";
  if (["XLSX", "XLS", "CSV"].includes(e)) return "grid";
  if (["DOCX", "DOC", "TXT", "MD"].includes(e)) return "paper";
  return "line";
}

function isPdfFile(fileName?: string): boolean {
  if (!fileName) return false;
  const lower = fileName.toLowerCase().trim();
  return lower.endsWith(".pdf") || lower.split(".").pop() === "pdf";
}

function parsePdfBinaryInfo(buffer: ArrayBuffer): {
  pageCount: number;
  title?: string;
  author?: string;
} {
  try {
    const bytes = new Uint8Array(buffer);
    const latin1 = new TextDecoder("latin1").decode(bytes);

    // 1. Root /Pages dictionary /Count
    const countMatches = [...latin1.matchAll(/\/Count\s+(\d+)/g)]
      .map((m) => parseInt(m[1], 10))
      .filter((n) => !isNaN(n) && n > 0);
    const maxCount = countMatches.length > 0 ? Math.max(...countMatches) : 0;

    // 2. Count distinct /Type /Page objects (excluding /Pages)
    const pageObjects = [...latin1.matchAll(/\/Type\s*\/Page\b(?!\s*s)/g)].length;

    // 3. Linearized N parameter
    const linMatch = latin1.match(/\/Linearized[\s\S]*?\/N\s+(\d+)/);
    const linCount = linMatch ? parseInt(linMatch[1], 10) : 0;

    const detectedPages = Math.max(maxCount, pageObjects, linCount, 1);

    let title: string | undefined;
    let author: string | undefined;
    const titleMatch = latin1.match(/\/Title\s*\(([^)]+)\)/);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].replace(/\\([()\\])/g, "$1").trim();
    }
    const authorMatch = latin1.match(/\/Author\s*\(([^)]+)\)/);
    if (authorMatch && authorMatch[1]) {
      author = authorMatch[1].replace(/\\([()\\])/g, "$1").trim();
    }

    return { pageCount: detectedPages, title, author };
  } catch {
    return { pageCount: 1 };
  }
}

async function lookupBookMetadata(title: string, author?: string): Promise<BookMetadata | null> {
  const params = new URLSearchParams({ title, limit: "5" });
  const response = await fetch(`https://openlibrary.org/search.json?${params}`, {
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`Book metadata search failed (${response.status})`);
  const data = await response.json();
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const docs: Record<string, any>[] = Array.isArray(data.docs) ? data.docs : [];
  const match = docs.find((doc) => {
    const candidate = String(doc.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    return candidate === normalizedTitle;
  });
  if (!match) return null;

  return {
    title: match.title,
    author: match.author_name?.[0] || author,
    publisher: match.publisher?.[0],
    publish_year: match.first_publish_year,
    description: Array.isArray(match.subject) ? match.subject.slice(0, 6).join(", ") : undefined,
    cover_url: Number.isInteger(match.cover_i)
      ? `https://covers.openlibrary.org/b/id/${match.cover_i}-L.jpg`
      : undefined,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadTextFile(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadQuoteImage(title: string, quote: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create a quote image.");
  context.fillStyle = "#f5f2eb";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#222";
  context.font = "600 34px Georgia";
  const words = quote.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > 960 && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  const visibleLines = lines.slice(0, 8);
  const startY = Math.max(180, (canvas.height - visibleLines.length * 52) / 2);
  visibleLines.forEach((value, index) => context.fillText(value, 120, startY + index * 52));
  context.fillStyle = "#777";
  context.font = "500 18px Arial";
  context.fillText(title.slice(0, 70), 120, 555);
  context.fillText("CLIO · A thought worth keeping", 120, 590);
  const link = document.createElement("a");
  link.download = "clio-quote.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function getLibraryProgress(item: LibraryItem): number {
  try {
    const saved = localStorage.getItem(`clio_reading_position_${item.id}`);
    if (saved) {
      const position = JSON.parse(saved);
      if (Number.isFinite(position.progress)) return Math.max(0, Math.min(100, position.progress));
      if (Number.isFinite(position.page) && Number.isFinite(position.total) && position.total > 0) {
        return Math.max(0, Math.min(100, Math.round((position.page / position.total) * 100)));
      }
    }
  } catch (error) {
    console.warn(`Unable to read progress for "${item.title}":`, error);
  }
  return Math.max(0, Math.min(100, item.progress || 0));
}

function initials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ─── Cover component ──────────────────────────────────────────────────────────
function Cover({ item, large = false }: { item: LibraryItem; large?: boolean }) {
  const [showExternalCover, setShowExternalCover] = useState(Boolean(item.metadata?.cover_url));
  const [firstPagePreview, setFirstPagePreview] = useState<string | null>(null);

  useEffect(() => {
    setShowExternalCover(Boolean(item.metadata?.cover_url));
    setFirstPagePreview(null);

    if (item.type.toLowerCase() !== "pdf") return;

    let cancelled = false;
    const renderFirstPage = async () => {
      try {
        let blob = await getLocalPdf(item.id);
        const token = localStorage.getItem("clio_token");
        if (!blob && token && !token.startsWith("local-token-")) {
          const response = await fetch(`${API}/library/${encodeURIComponent(item.id)}/file`, {
            headers: { Authorization: "Bearer " + token },
          });
          if (response.ok) blob = await response.blob();
        }
        if (!blob || cancelled) return;

        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: large ? 0.7 : 0.5 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (!cancelled) setFirstPagePreview(canvas.toDataURL("image/jpeg", 0.82));
      } catch (error) {
        console.warn("Unable to create first-page cover preview:", error);
      }
    };

    renderFirstPage();
    return () => {
      cancelled = true;
    };
  }, [item.id, item.type, large]);

  if (firstPagePreview) {
    return (
      <div
        className={`cover cover-first-page ${large ? "cover-large" : ""}`}
        aria-label={`First page of ${item.title}`}
      >
        <img src={firstPagePreview} alt={`First page of ${item.title}`} />
      </div>
    );
  }

  if (showExternalCover && item.metadata?.cover_url) {
    return (
      <div
        className={`cover cover-external ${large ? "cover-large" : ""}`}
        aria-label={`${item.title} by ${item.author}`}
      >
        <img
          src={item.metadata.cover_url}
          alt={`Cover of ${item.title}`}
          onError={() => setShowExternalCover(false)}
        />
      </div>
    );
  }

  return (
    <div
      className={`cover cover-${item.tone} ${large ? "cover-large" : ""}`}
      aria-label={`${item.title} by ${item.author}`}
    >
      <span className="cover-kicker">CLIO LIBRARY</span>
      <div className="cover-art" aria-hidden="true">
        <i />
        <b />
        <b />
        <b />
      </div>
      <strong className="cover-title">{item.title}</strong>
      <div className="cover-bottom">
        <span>{item.author}</span>
        <small>{item.type}</small>
      </div>
    </div>
  );
}

function ReaderCoverPreview({ item, token }: { item: LibraryItem; token: string | null }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const renderPreview = async () => {
      if (item.type.toLowerCase() !== "pdf") return;
      try {
        let blob = await getLocalPdf(item.id);
        if (!blob && token && !token.startsWith("local-token-")) {
          const response = await fetch(`${API}/library/${encodeURIComponent(item.id)}/file`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) blob = await response.blob();
        }
        if (!blob || cancelled) return;
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.55 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
        if (!cancelled) {
          objectUrl = canvas.toDataURL("image/jpeg", 0.82);
          setPreviewUrl(objectUrl);
        }
      } catch (error) {
        console.warn("Unable to create document cover preview:", error);
      }
    };

    renderPreview();
    return () => {
      cancelled = true;
      if (objectUrl?.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
    };
  }, [item.id, item.type, token]);

  if (!previewUrl) return <Cover item={item} />;
  return (
    <div className="reader-cover-preview" aria-label={`First page of ${item.title}`}>
      <img src={previewUrl} alt="" />
    </div>
  );
}

function PdfPageThumbnail({
  item,
  token,
  pageNumber,
}: {
  item: LibraryItem;
  token: string | null;
  pageNumber: number;
}) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let started = false;
    const render = async () => {
      if (started || cancelled) return;
      started = true;
      try {
        const pdf = await getThumbnailDocument(item, token);
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 0.18 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Unable to create a PDF thumbnail canvas.");
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (!cancelled) setPreviewUrl(canvas.toDataURL("image/jpeg", 0.72));
      } catch (error) {
        if (!cancelled)
          console.warn(`Unable to render PDF thumbnail for page ${pageNumber}:`, error);
      }
    };

    const container = containerRef.current;
    if (!container || !("IntersectionObserver" in window)) {
      void render();
      return () => {
        cancelled = true;
      };
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void render();
        observer.disconnect();
      }
    });
    observer.observe(container);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [item, pageNumber, token]);

  return (
    <span ref={containerRef} className="pdf-page-thumbnail" aria-hidden="true">
      {previewUrl ? <img src={previewUrl} alt="" loading="lazy" /> : <FileText size={13} />}
    </span>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function getReaderPosition(
  itemId: string,
): { page: number; scrollTop: number; viewMode: "canvas" | "text"; zoom: number } | null {
  try {
    const saved = localStorage.getItem(`clio_reading_position_${itemId}`);
    if (!saved) return null;
    const value = JSON.parse(saved);
    return {
      page: Number.isInteger(value.page) && value.page > 0 ? value.page : 1,
      scrollTop: Number.isFinite(value.scrollTop) ? Math.max(0, value.scrollTop) : 0,
      viewMode: value.viewMode === "text" ? "text" : "canvas",
      zoom: Number.isFinite(value.zoom) ? Math.min(1.8, Math.max(0.7, value.zoom)) : 1,
    };
  } catch (error) {
    console.warn("Unable to read the saved reading position:", error);
    return null;
  }
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function AuthModal({
  onAuth,
  close,
}: {
  onAuth: (token: string, user: User) => void;
  close: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        try {
          const response = await apiFetch("/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, username, password, full_name: fullName }),
          });
          const result = response.data || response;
          if (result.access_token && result.user?.id) {
            onAuth(result.access_token, {
              id: String(result.user.id),
              email: result.user.email,
              full_name: result.user.full_name || fullName,
              username: result.user.username || username,
              avatar_url: result.user.avatar_url,
            });
            return;
          }
        } catch (apiErr: any) {
          if (
            apiErr.message &&
            !apiErr.message.includes("Failed to fetch") &&
            !apiErr.message.includes("Network error")
          ) {
            throw apiErr;
          }
        }
      } else {
        try {
          const response = await apiFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });
          const result = response.data || response;
          if (result.access_token && result.user?.id) {
            onAuth(result.access_token, {
              id: String(result.user.id),
              email: result.user.email,
              full_name: result.user.full_name,
              username: result.user.username,
              avatar_url: result.user.avatar_url,
            });
            return;
          }
        } catch (apiErr: any) {
          if (
            apiErr.message &&
            !apiErr.message.includes("Failed to fetch") &&
            !apiErr.message.includes("Network error")
          ) {
            throw apiErr;
          }
        }
      }

      // Seamless fallback for mobile network restrictions
      const localToken = `local-token-${Date.now()}`;
      const localUser: User = {
        id: `local-user-${Date.now()}`,
        email: email || "user@clio.local",
        full_name: fullName || email.split("@")[0] || "CLIO User",
        username: username || email.split("@")[0] || "clio_reader",
      };
      onAuth(localToken, localUser);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay auth-overlay" role="presentation" onMouseDown={close} onClick={close}>
      <div
        className="modal auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        style={{ maxWidth: 420 }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">CLIO ACCOUNT</span>
            <h2 id="auth-modal-title">{mode === "login" ? "Sign in to CLIO" : "Create account"}</h2>
          </div>
          <button onClick={close} aria-label="Close sign in">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label>
              Full name
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Rivera"
                required
              />
            </label>
          )}
          {mode === "register" && (
            <label>
              Username
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="alex_rivera"
                required
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_]{3,30}"
                autoComplete="username"
                title="Use 3–30 letters, numbers, or underscores."
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </label>
          {error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{error}</p>}
          <button className="primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? (
              <Loader2 size={16} className="spin" />
            ) : mode === "login" ? (
              <>
                <LogIn size={15} /> Sign in
              </>
            ) : (
              <>
                <User size={15} /> Create account
              </>
            )}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "Create a new account" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({
  go,
  openSearch,
  openImport,
  openReader,
  items,
  user,
  loadingItems,
}: {
  go: (p: Page) => void;
  openSearch: () => void;
  openImport: () => void;
  openReader: (book: LibraryItem) => void;
  items: LibraryItem[];
  user: User | null;
  loadingItems: boolean;
}) {
  const now = new Date();
  const dateLabel = now
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();

  const inProgress = items.filter(
    (item) => getLibraryProgress(item) > 0 && getLibraryProgress(item) < 100,
  );
  const recentItems = items.slice(0, 4);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [onboardingVisible, setOnboardingVisible] = useState(
    () => localStorage.getItem("clio_onboarding_complete") !== "true",
  );
  const [monthlyGoal, setMonthlyGoal] = useState(() =>
    Math.max(1, Number(localStorage.getItem("clio_monthly_goal_pages")) || 100),
  );
  const [activity] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("clio_reading_activity") || "[]");
      return Array.isArray(saved)
        ? (saved as {
            key?: string;
            date: string;
            itemId: string;
            title: string;
            page: number;
            timestamp: number;
          }[])
        : [];
    } catch (error) {
      console.warn("Unable to load reading activity:", error);
      return [];
    }
  });
  const [readingSeconds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("clio_reading_time_by_day") || "{}");
      return saved && typeof saved === "object" ? (saved as Record<string, number>) : {};
    } catch (error) {
      console.warn("Unable to load reading time:", error);
      return {};
    }
  });
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setUTCDate(today.getUTCDate() - 6);
  const weekStartKey = weekStart.toISOString().slice(0, 10);
  const thisWeekActivity = activity.filter((entry) => entry.date >= weekStartKey);
  const weeklyPages = thisWeekActivity.length;
  const monthStartKey = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const monthlyPages = activity.filter((entry) => entry.date >= monthStartKey).length;
  const weeklySeconds = Object.entries(readingSeconds)
    .filter(([date]) => date >= weekStartKey)
    .reduce((total, [, seconds]) => total + (Number(seconds) || 0), 0);
  const activeDates = new Set(activity.map((entry) => entry.date));
  let readingStreak = 0;
  const streakDay = new Date(today);
  if (!activeDates.has(streakDay.toISOString().slice(0, 10)))
    streakDay.setUTCDate(streakDay.getUTCDate() - 1);
  while (activeDates.has(streakDay.toISOString().slice(0, 10)) && readingStreak < 365) {
    readingStreak += 1;
    streakDay.setUTCDate(streakDay.getUTCDate() - 1);
  }
  const topicCounts = Object.values(
    (() => {
      try {
        return JSON.parse(localStorage.getItem("clio_library_organization") || "{}");
      } catch {
        return {};
      }
    })() as Record<string, { tags?: string[] }>,
  )
    .flatMap((record) => record.tags || [])
    .reduce<Record<string, number>>(
      (counts, tag) => ({ ...counts, [tag]: (counts[tag] || 0) + 1 }),
      {},
    );
  const favoriteTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const completedBooks = items.filter((item) => getLibraryProgress(item) >= 100).length;
  const homeFeatures: {
    page?: Page;
    label: string;
    description: string;
    icon: any;
    action?: () => void;
  }[] = [
    {
      label: "Import a file",
      description: "Add a book or document",
      icon: Upload,
      action: openImport,
    },
    {
      page: "My Library",
      label: "My library",
      description: "Browse everything you saved",
      icon: Library,
    },
    {
      page: "Discover Books",
      label: "Discover books",
      description: "Find something new to read",
      icon: Compass,
    },
    {
      page: "Collections",
      label: "Collections",
      description: "Organise related ideas",
      icon: Folder,
    },
    {
      page: "Ask Your Library",
      label: "Ask your library",
      description: "Find answers in your files",
      icon: Sparkles,
    },
    {
      page: "Study Workspace",
      label: "Study workspace",
      description: "Turn reading into progress",
      icon: BrainCircuit,
    },
    {
      page: "File Converter",
      label: "File converter",
      description: "Change document formats",
      icon: ArrowLeftRight,
    },
    {
      page: "Downloaded Files",
      label: "Downloaded files",
      description: "Reopen saved exports",
      icon: Download,
    },
    {
      page: "PDF Toolkit",
      label: "PDF toolkit",
      description: "Extract and manage PDF pages",
      icon: FileArchive,
    },
    {
      page: "Reading Dashboard",
      label: "Reading dashboard",
      description: "Track time and progress",
      icon: BarChart3,
    },
    {
      page: "Highlights",
      label: "Highlights",
      description: "Return to saved passages",
      icon: Highlighter,
    },
    {
      page: "Reading Memory",
      label: "Reading memory",
      description: "Review your reading trail",
      icon: BookMarked,
    },
    {
      page: "Knowledge Graph",
      label: "Knowledge graph",
      description: "See connections across files",
      icon: Network,
    },
    { page: "Profile", label: "Profile", description: "Manage your account", icon: User },
    { page: "Settings", label: "Settings", description: "Adjust your preferences", icon: Settings },
    {
      page: "Help and Support",
      label: "Help and support",
      description: "Get guidance when needed",
      icon: CircleHelp,
    },
  ];

  return (
    <main className="page dashboard">
      {activeVideo && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setActiveVideo(null)}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 720,
              aspectRatio: "16/9",
              background: "#000",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveVideo(null)}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 10,
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.7)",
                color: "#fff",
                border: 0,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${activeVideo}?autoplay=1`}
              title="YouTube video player"
              style={{ width: "100%", height: "100%", border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      )}
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">{dateLabel}</span>
          <h1>{greetingFor()}</h1>
          <p>
            {user
              ? `Welcome back, ${user.full_name?.split(" ")[0] || user.email}.`
              : "Pick up where your curiosity left off."}
          </p>
        </div>
      </section>

      {onboardingVisible && (
        <section className="clio-onboarding">
          <div className="clio-onboarding-copy">
            <span className="eyebrow">YOUR READING SPACE</span>
            <h2>Make CLIO yours</h2>
            <p>
              Set a goal, choose a comfortable reading theme, or try a guided sample before adding
              your own books.
            </p>
          </div>
          <div className="clio-onboarding-actions">
            <button
              onClick={() => {
                const answer = window.prompt("Monthly page goal", String(monthlyGoal));
                if (!answer) return;
                const parsedGoal = Number(answer);
                if (!Number.isFinite(parsedGoal) || parsedGoal <= 0) {
                  window.alert("Enter a page goal greater than zero.");
                  return;
                }
                const goal = Math.max(1, Math.min(10000, Math.round(parsedGoal)));
                setMonthlyGoal(goal);
                localStorage.setItem("clio_monthly_goal_pages", String(goal));
              }}
            >
              <Target size={16} /> Set reading goal
            </button>
            <button onClick={() => localStorage.setItem("clio_reader_theme_default", "sepia")}>
              <Eye size={16} /> Choose sepia theme
            </button>
            <button
              onClick={() =>
                openReader({
                  id: "clio-guided-sample",
                  title: "A short guide to active reading",
                  author: "CLIO",
                  type: "DOCX",
                  progress: 0,
                  tone: toneForType("DOCX"),
                  mark: "CLIO",
                  chapters: sampleChapters,
                  content: sampleChapters
                    .map((chapter) =>
                      [chapter.title, chapter.lead, ...chapter.paragraphs].join("\n\n"),
                    )
                    .join("\n\n"),
                })
              }
            >
              <BookOpen size={16} /> Try the sample
            </button>
            <button
              className="onboarding-dismiss"
              onClick={() => {
                localStorage.setItem("clio_onboarding_complete", "true");
                setOnboardingVisible(false);
              }}
            >
              I’ll explore on my own <ArrowRight size={14} />
            </button>
          </div>
        </section>
      )}

      <section className="home-command section">
        <div className="section-title">
          <div>
            <span className="eyebrow">CLIO WORKSPACE</span>
            <h2>Everything in one place</h2>
          </div>
          {items.length > 0 && (
            <span className="home-library-count">
              <Activity size={14} /> {items.length} item{items.length === 1 ? "" : "s"} saved
            </span>
          )}
        </div>
        <div className="home-command-grid">
          {homeFeatures.map(({ page, label, description, icon: Icon, action }, index) => (
            <button
              className={`home-command-card${index === 0 ? " home-command-primary" : ""}`}
              key={label}
              onClick={action || (() => page && go(page))}
            >
              <span>
                <Icon size={19} />
              </span>
              <strong>{label}</strong>
              <small>{description}</small>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      </section>

      <HomeDownloadsPreview onOpenDownloads={() => go("Downloaded Files")} />

      <section className="section">
        <div className="section-title">
          <div>
            <span className="eyebrow">YOUR LIBRARY</span>
            <h2>{inProgress.length > 0 ? "Continue reading" : "Your library"}</h2>
          </div>
          <button onClick={() => go("My Library")}>
            View all <ArrowRight size={15} />
          </button>
        </div>
        {loadingItems ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "24px 0",
              color: "#888",
            }}
          >
            <Loader2 size={18} className="spin" /> Loading your library...
          </div>
        ) : recentItems.length === 0 ? (
          <div className="empty-state" style={{ padding: "32px 0", textAlign: "center" }}>
            <Upload size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ color: "#888" }}>
              Your library is empty. Import your first file to get started.
            </p>
            <button className="primary" onClick={openImport} style={{ marginTop: 12 }}>
              <Upload size={15} /> Import files
            </button>
          </div>
        ) : (
          <div className="continue-grid">
            {recentItems.map((book) => (
              <article className="continue-card" key={book.id} onClick={() => openReader(book)}>
                <Cover item={book} />
                <div className="continue-info">
                  <span className="type">{book.type}</span>
                  <h3>{book.title}</h3>
                  <p>{book.author}</p>
                  {book.progress > 0 && (
                    <div className="progress-row">
                      <Progress value={book.progress} />
                      <span>{book.progress}%</span>
                    </div>
                  )}
                  <small>{formatRelative(book.created_at || book.uploadedAt)}</small>
                </div>
                <button
                  className="round-btn"
                  aria-label="Resume"
                  onClick={(e) => {
                    e.stopPropagation();
                    openReader(book);
                  }}
                >
                  <Play size={15} fill="currentColor" />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section reading-week-section">
        <div className="section-title">
          <div>
            <span className="eyebrow">YOUR MOMENTUM</span>
            <h2>This week in reading</h2>
          </div>
          <button onClick={() => go("Reading Dashboard")}>
            View analytics <ArrowRight size={15} />
          </button>
        </div>
        <div className="reading-week-grid">
          <article>
            <span>Pages this month</span>
            <strong>{monthlyPages}</strong>
            <small>of {monthlyGoal} page goal</small>
            <Progress value={Math.min(100, (monthlyPages / monthlyGoal) * 100)} />
          </article>
          <article>
            <span>Reading streak</span>
            <strong>
              {readingStreak} <small>days</small>
            </strong>
            <small>
              {readingStreak ? "Nice rhythm—keep it going." : "Open a book today to begin."}
            </small>
          </article>
          <article>
            <span>Time this week</span>
            <strong>
              {Math.floor(weeklySeconds / 60)} <small>min</small>
            </strong>
            <small>
              Across {new Set(thisWeekActivity.map((entry) => entry.itemId)).size} documents
            </small>
          </article>
          <article>
            <span>Books finished</span>
            <strong>{completedBooks}</strong>
            <small>In your library</small>
          </article>
        </div>
        <div className="reading-topics">
          <div>
            <b>Favorite topics</b>
            <small>From your library tags</small>
          </div>
          {favoriteTopics.length ? (
            favoriteTopics.map(([topic, count]) => (
              <span key={topic}>
                #{topic} <small>{count}</small>
              </span>
            ))
          ) : (
            <span className="topic-empty">Add tags to books to discover your favorite topics.</span>
          )}
        </div>
        {thisWeekActivity.length > 0 && (
          <div className="reading-timeline">
            <b>Recent reading</b>
            {thisWeekActivity.slice(0, 4).map((entry) => (
              <button
                key={entry.key || `${entry.itemId}-${entry.page}-${entry.timestamp}`}
                onClick={() => {
                  const item = items.find((candidate) => candidate.id === entry.itemId);
                  if (item) openReader(item);
                }}
              >
                <span>
                  {new Date(entry.date).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
                <span>{entry.title}</span>
                <small>Page {entry.page}</small>
              </button>
            ))}
          </div>
        )}
        <button
          className="reading-report-export"
          onClick={() =>
            downloadTextFile(
              "clio-reading-report.md",
              [
                "# CLIO Reading Report",
                "",
                `- Pages visited this week: ${weeklyPages}`,
                `- Reading streak: ${readingStreak} days`,
                `- Reading time this week: ${Math.floor(weeklySeconds / 60)} minutes`,
                `- Books completed: ${completedBooks}`,
                `- Monthly goal: ${monthlyGoal} pages`,
                "",
                "## Recent reading",
                ...thisWeekActivity
                  .slice(0, 20)
                  .map((entry) => `- ${entry.date} — ${entry.title}, page ${entry.page}`),
              ].join("\n"),
            )
          }
        >
          <Download size={14} /> Export reading report
        </button>
      </section>

      <section className="section" style={{ marginTop: 28 }}>
        <div className="section-title">
          <div>
            <span className="eyebrow">AUDIOBOOK SPOTLIGHT</span>
            <h2>Full audiobooks of classic novels</h2>
          </div>
        </div>
        <div
          className="continue-grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}
        >
          {[
            {
              title: "Pride and Prejudice - Full Audiobook by Jane Austen",
              author: "Classic Audiobooks",
              videoId: "S_GZz1Q61-8",
              thumbnail:
                "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
              duration: "11:15",
            },
            {
              title: "The Great Gatsby - Full Audiobook by F. Scott Fitzgerald",
              author: "Great Literature",
              videoId: "5V82r3_c_Yg",
              thumbnail:
                "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&auto=format&fit=crop&q=80",
              duration: "4:42",
            },
            {
              title: "Moby Dick - Full Audiobook by Herman Melville",
              author: "Audiobook Classics",
              videoId: "h1Pz46W_6p4",
              thumbnail:
                "https://images.unsplash.com/photo-1495640388908-05fa85288e61?w=600&auto=format&fit=crop&q=80",
              duration: "21:10",
            },
          ].map((vid, idx) => (
            <div
              key={idx}
              className="audiobook-card"
              style={{
                background: "#fff",
                border: "1px solid #deddd9",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                cursor: "pointer",
              }}
              onClick={() => {
                setActiveVideo(vid.videoId);
              }}
            >
              <div style={{ position: "relative", width: "100%", height: 150, background: "#111" }}>
                <img
                  src={vid.thumbnail}
                  alt={vid.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(0,0,0,0.3)",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.95)",
                      display: "grid",
                      placeItems: "center",
                      color: "#111",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    }}
                  >
                    <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />
                  </div>
                </div>
                <span
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    background: "rgba(0,0,0,0.75)",
                    color: "#fff",
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontWeight: 500,
                  }}
                >
                  {vid.duration}
                </span>
              </div>
              <div
                style={{
                  padding: 14,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <h3
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#111",
                    margin: "0 0 6px",
                    lineHeight: 1.3,
                  }}
                >
                  {vid.title}
                </h3>
                <small style={{ fontSize: "11px", color: "#666" }}>
                  {vid.author} · YouTube Spotlight
                </small>
              </div>
            </div>
          ))}
        </div>
      </section>

      {items.length > 0 && (
        <div className="dashboard-split">
          <section className="section stats-card">
            <div className="section-title compact">
              <div>
                <span className="eyebrow">LIBRARY STATS</span>
                <h2>Your collection</h2>
              </div>
              <button onClick={() => go("Reading Analytics")}>
                Details <ArrowRight size={15} />
              </button>
            </div>
            <div className="stats">
              <div>
                <strong>{items.length}</strong>
                <small>Total items</small>
              </div>
              <div>
                <strong>{items.filter((item) => getLibraryProgress(item) > 0).length}</strong>
                <small>In progress</small>
              </div>
              <div>
                <strong>{items.filter((item) => getLibraryProgress(item) >= 100).length}</strong>
                <small>Completed</small>
              </div>
            </div>
            <div className="chart">
              {["Books", "PDF", "PPTX", "DOCX", "Other"].map((cat) => {
                const count = items.filter((i) => {
                  const t = i.type.toUpperCase();
                  if (cat === "Books") return ["EPUB", "MOBI"].includes(t);
                  if (cat === "Other")
                    return !["EPUB", "MOBI", "PDF", "PPTX", "PPT", "DOCX", "DOC"].includes(t);
                  return t.startsWith(cat);
                }).length;
                const max = Math.max(1, items.length);
                return (
                  <div key={cat}>
                    <span
                      style={{ height: `${Math.round((count / max) * 100)}%` }}
                      className={count > 0 ? "active" : ""}
                    />
                    <small>{cat}</small>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="section highlights-card">
            <div className="section-title compact">
              <div>
                <span className="eyebrow">READING SNAPSHOT</span>
                <h2>Keep your momentum</h2>
              </div>
            </div>
            <p className="home-snapshot-copy">
              {inProgress.length > 0
                ? `${inProgress.length} ${inProgress.length === 1 ? "item is" : "items are"} currently in progress.`
                : "Start reading to build your personal reading trail."}
            </p>
            <button className="secondary" onClick={() => go("Reading Dashboard")}>
              Open reading dashboard <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}

      <section className="section">
        <div className="section-title">
          <div>
            <span className="eyebrow">SHORTCUTS</span>
            <h2>Quick actions</h2>
          </div>
        </div>
        <div className="quick-grid">
          {[
            [Upload, "Import files", "Add books and documents", openImport],
            [
              Sparkles,
              "Ask your library",
              "Find answers with sources",
              () => go("Ask Your Library"),
            ],
            [ArrowLeftRight, "Convert a file", "Transform any format", () => go("File Converter")],
            [FolderPlus, "New collection", "Organise your knowledge", () => go("Collections")],
          ].map(([Icon, title, text, action]: any) => (
            <button className="quick-card" key={title} onClick={action}>
              <span>
                <Icon size={19} />
              </span>
              <div>
                <b>{title}</b>
                <small>{text}</small>
              </div>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

// ─── Open Library Discovery ──────────────────────────────────────────────────
function OpenLibraryPage() {
  const [searchText, setSearchText] = useState("");
  const [request, setRequest] = useState<{ term: string; page: number } | null>(null);
  const [books, setBooks] = useState<OpenLibraryBook[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<string, OpenLibrarySearchResponse>());
  const lastRequestAt = useRef(0);
  const pageSize = 18;

  useEffect(() => {
    if (!request) return;

    const cacheKey = `${request.term.toLowerCase()}:${request.page}`;
    const cached = cache.current.get(cacheKey);
    if (cached) {
      setBooks(cached.docs);
      setTotalFound(cached.numFound ?? cached.num_found ?? 0);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const wait = Math.max(0, 1100 - (Date.now() - lastRequestAt.current));
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(async () => {
      try {
        const url = new URL("https://openlibrary.org/search.json");
        url.searchParams.set("q", request.term);
        url.searchParams.set(
          "fields",
          "key,title,author_name,first_publish_year,cover_i,edition_count,subject",
        );
        url.searchParams.set("limit", String(pageSize));
        url.searchParams.set("page", String(request.page));
        lastRequestAt.current = Date.now();

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Open Library search failed (${response.status}).`);
        }

        const result: OpenLibrarySearchResponse = await response.json();
        if (!Array.isArray(result.docs)) {
          throw new Error("Open Library returned an unexpected search response.");
        }

        cache.current.set(cacheKey, result);
        setBooks(result.docs);
        setTotalFound(result.numFound ?? result.num_found ?? 0);
      } catch (searchError) {
        if (controller.signal.aborted) return;
        setError(
          searchError instanceof Error
            ? searchError.message
            : "Unable to search Open Library. Please try again.",
        );
        setBooks([]);
        setTotalFound(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, wait);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [request]);

  const search = (term: string) => {
    const normalized = term.trim();
    if (normalized.length < 2) return;
    setSearchText(normalized);
    setRequest({ term: normalized, page: 1 });
  };

  const lastPage = request ? Math.max(1, Math.ceil(totalFound / pageSize)) : 1;
  const firstResult = request && totalFound > 0 ? (request.page - 1) * pageSize + 1 : 0;
  const lastResult = request ? Math.min(request.page * pageSize, totalFound) : 0;

  return (
    <main className="page open-library-page">
      <section className="open-library-hero">
        <span className="eyebrow">OPEN LIBRARY CATALOG</span>
        <h1>Find your next read.</h1>
        <p>Explore books and authors from the Open Library catalog.</p>
        <form
          className="open-library-search"
          onSubmit={(event) => {
            event.preventDefault();
            search(searchText);
          }}
        >
          <Search size={19} aria-hidden="true" />
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search by title, author, or subject..."
            aria-label="Search books by title, author, or subject"
            minLength={2}
            required
          />
          <button className="primary" type="submit" disabled={loading}>
            {loading ? <Loader2 className="spin" size={16} /> : <Search size={16} />}
            <span>Search books</span>
          </button>
        </form>
        <div className="open-library-topics" aria-label="Popular searches">
          <span>Try</span>
          {["Science fiction", "African literature", "Mystery", "Fantasy"].map((topic) => (
            <button type="button" key={topic} onClick={() => search(topic)}>
              {topic}
            </button>
          ))}
        </div>
      </section>

      {request ? (
        <section className="open-library-results" aria-live="polite">
          <div className="open-library-results-heading">
            <div>
              <span className="eyebrow">BOOK DISCOVERY</span>
              <h2>{loading ? "Searching the catalog..." : `Results for “${request.term}”`}</h2>
            </div>
            {!loading && !error && totalFound > 0 && (
              <span className="open-library-result-count">{totalFound.toLocaleString()} books</span>
            )}
          </div>

          {error ? (
            <div className="open-library-message" role="alert">
              <p>{error}</p>
              <button className="secondary" onClick={() => search(request.term)}>
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="open-library-message">
              <Loader2 className="spin" size={22} />
              <p>Searching Open Library…</p>
            </div>
          ) : books.length === 0 ? (
            <div className="open-library-message">
              <BookOpen size={24} />
              <p>No books found. Try another title, author, or subject.</p>
            </div>
          ) : (
            <>
              <div className="open-library-grid">
                {books.map((book, index) => {
                  const workId = book.key?.match(/^\/works\/(OL\d+W)$/)?.[1];
                  const openLibraryUrl = workId ? `https://openlibrary.org/works/${workId}` : null;

                  return (
                    <article
                      className="open-library-card"
                      key={`${book.key || book.title}-${index}`}
                    >
                      <div className="open-library-cover">
                        <BookOpen size={30} aria-hidden="true" />
                        {Number.isInteger(book.cover_i) && (
                          <img
                            src={`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`}
                            alt={`Cover of ${book.title}`}
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.hidden = true;
                            }}
                          />
                        )}
                      </div>
                      <div className="open-library-book-info">
                        {book.first_publish_year && (
                          <span className="open-library-year">{book.first_publish_year}</span>
                        )}
                        <h3>{book.title || "Untitled"}</h3>
                        <p>{book.author_name?.slice(0, 2).join(", ") || "Unknown author"}</p>
                        {book.edition_count !== undefined && (
                          <small>
                            {book.edition_count.toLocaleString()} edition
                            {book.edition_count === 1 ? "" : "s"}
                          </small>
                        )}
                        {openLibraryUrl && (
                          <a
                            className="open-library-link"
                            href={openLibraryUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View on Open Library <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              {lastPage > 1 && (
                <nav className="open-library-pagination" aria-label="Search result pages">
                  <button
                    className="secondary"
                    disabled={request.page <= 1 || loading}
                    onClick={() =>
                      setRequest((current) =>
                        current ? { ...current, page: current.page - 1 } : current,
                      )
                    }
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <span>
                    {firstResult}–{lastResult} of {totalFound.toLocaleString()}
                  </span>
                  <button
                    className="secondary"
                    disabled={request.page >= lastPage || loading}
                    onClick={() =>
                      setRequest((current) =>
                        current ? { ...current, page: current.page + 1 } : current,
                      )
                    }
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      ) : (
        <section className="open-library-welcome">
          <span className="open-library-welcome-icon">
            <BookOpen size={22} />
          </span>
          <div>
            <h2>A world of books, one search away.</h2>
            <p>
              Search Open Library’s public catalog, browse covers, and open a book’s catalog record
              for more details.
            </p>
          </div>
        </section>
      )}

      <footer className="open-library-attribution">
        Book data and covers provided by{" "}
        <a href="https://openlibrary.org/" target="_blank" rel="noreferrer">
          Open Library
        </a>
      </footer>
    </main>
  );
}

// ─── Library Page ─────────────────────────────────────────────────────────────
function LibraryPage({
  openReader,
  openImport,
  items,
  token,
  loadingItems,
  onDelete,
}: {
  openReader: (doc: LibraryItem) => void;
  openImport: () => void;
  items: LibraryItem[];
  token: string | null;
  loadingItems: boolean;
  onDelete: (id: string) => void;
}) {
  const [grid, setGrid] = useState(true);
  const [filter, setFilter] = useState("All items");
  const [shelf, setShelf] = useState<
    "all" | "reading" | "finished" | "favorites" | "pinned" | "recommended"
  >("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "title" | "progress">("recent");
  const [organization, setOrganization] = useState<
    Record<string, { favorite: boolean; pinned: boolean; tags: string[]; collection: string }>
  >(() => {
    try {
      return JSON.parse(localStorage.getItem("clio_library_organization") || "{}");
    } catch (error) {
      console.warn("Unable to load library organization:", error);
      return {};
    }
  });
  const [pendingItemIds, setPendingItemIds] = useState(() =>
    readPendingSyncActions().map((action) => action.itemId),
  );
  const [organizationNotice, setOrganizationNotice] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    item: LibraryItem;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("clio_library_organization", JSON.stringify(organization));
    } catch (error) {
      console.error("Unable to save library organization:", error);
    }
  }, [organization]);

  useEffect(() => {
    const updatePendingItems = () =>
      setPendingItemIds(readPendingSyncActions().map((action) => action.itemId));
    window.addEventListener("clio-sync-queued", updatePendingItems);
    window.addEventListener("clio-sync-complete", updatePendingItems);
    return () => {
      window.removeEventListener("clio-sync-queued", updatePendingItems);
      window.removeEventListener("clio-sync-complete", updatePendingItems);
    };
  }, []);

  const isFavorite = (item: LibraryItem) =>
    organization[item.id]?.favorite ?? item.is_favourite ?? false;
  const itemTags = (item: LibraryItem) => organization[item.id]?.tags ?? item.tags ?? [];

  const toggleOrganizationFlag = async (item: LibraryItem, field: "favorite" | "pinned") => {
    const nextValue = !(field === "favorite" ? isFavorite(item) : organization[item.id]?.pinned);
    setOrganization((previous) => ({
      ...previous,
      [item.id]: {
        ...previous[item.id],
        favorite: previous[item.id]?.favorite ?? item.is_favourite ?? false,
        pinned: previous[item.id]?.pinned ?? false,
        tags: previous[item.id]?.tags ?? item.tags ?? [],
        collection: previous[item.id]?.collection ?? item.collectionName ?? "",
        [field]: nextValue,
      },
    }));
    if (field !== "favorite" || !token || item.id.startsWith("local-")) return;
    const payload = JSON.stringify({ is_favourite: nextValue });
    const path = `/library/${encodeURIComponent(item.id)}`;
    try {
      await apiFetch(path, { method: "PATCH", body: payload }, token);
    } catch (error) {
      console.warn("Unable to sync favorite status; queueing for offline sync:", error);
      try {
        queueOfflineSyncAction({ itemId: item.id, path, method: "PATCH", body: payload });
        window.dispatchEvent(new Event("clio-sync-queued"));
      } catch (queueError) {
        console.error("Unable to queue favorite status:", queueError);
      }
    }
  };

  const editOrganization = (item: LibraryItem) => {
    const current = organization[item.id] || {
      favorite: item.is_favourite || false,
      pinned: false,
      tags: item.tags || [],
      collection: item.collectionName || "",
    };
    const collection = window.prompt("Collection name", current.collection);
    if (collection === null) return;
    const tags = window.prompt("Tags, separated by commas", current.tags.join(", "));
    if (tags === null) return;
    const nextTags = [
      ...new Set(
        tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ].slice(0, 12);
    setOrganization((previous) => ({
      ...previous,
      [item.id]: {
        ...current,
        collection: collection.trim(),
        tags: nextTags,
      },
    }));
    if (token && !item.id.startsWith("local-")) {
      const path = `/library/${encodeURIComponent(item.id)}`;
      const body = JSON.stringify({ tags: nextTags });
      void apiFetch(path, { method: "PATCH", body }, token).catch((error) => {
        console.warn("Unable to sync library tags; queueing for offline sync:", error);
        try {
          queueOfflineSyncAction({ itemId: item.id, path, method: "PATCH", body });
          window.dispatchEvent(new Event("clio-sync-queued"));
        } catch (queueError) {
          console.error("Unable to queue library tags:", queueError);
        }
      });
      if (collection.trim()) {
        void (async () => {
          try {
            const response = await apiFetch("/collections", {}, token);
            const collections = Array.isArray(response) ? response : response.collections || [];
            const existing = collections.find(
              (entry: { id?: string; _id?: string; name?: string }) =>
                entry.name?.trim().toLocaleLowerCase() === collection.trim().toLocaleLowerCase(),
            );
            const savedCollection =
              existing ||
              (await apiFetch(
                "/collections",
                { method: "POST", body: JSON.stringify({ name: collection.trim() }) },
                token,
              ));
            const collectionId = savedCollection.id || savedCollection._id;
            if (!collectionId) throw new Error("The collection service returned no collection ID.");
            await apiFetch(
              `/collections/${encodeURIComponent(collectionId)}/items`,
              {
                method: "POST",
                body: JSON.stringify({ library_item_id: item.id }),
              },
              token,
            );
            setOrganizationNotice(`Added "${item.title}" to "${collection.trim()}".`);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "The collection could not be synced.";
            setOrganizationNotice(`Saved on this device. Cloud collection sync failed: ${message}`);
          }
        })();
      }
    }
  };

  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("scroll", closeMenu, true);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeMenu);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("scroll", closeMenu, true);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeMenu);
    };
  }, [contextMenu]);

  const showContextMenu = (event: React.MouseEvent, item: LibraryItem) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 176;
    const menuHeight = 88;
    const targetBounds = event.currentTarget.getBoundingClientRect();
    const pointerX = Number.isFinite(event.clientX)
      ? event.clientX
      : targetBounds.left + targetBounds.width / 2;
    const pointerY = Number.isFinite(event.clientY)
      ? event.clientY
      : targetBounds.top + targetBounds.height / 2;
    setContextMenu({
      item,
      x: Math.max(8, Math.min(pointerX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(pointerY, window.innerHeight - menuHeight - 8)),
    });
  };

  const visible = useMemo(() => {
    let list = [...items];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (x) =>
          x.title.toLowerCase().includes(q) ||
          x.author.toLowerCase().includes(q) ||
          x.type.toLowerCase().includes(q) ||
          itemTags(x).some((tag) => tag.toLowerCase().includes(q)) ||
          (organization[x.id]?.collection || x.collectionName || "").toLowerCase().includes(q),
      );
    }
    if (shelf === "reading")
      list = list.filter((item) => getLibraryProgress(item) > 0 && getLibraryProgress(item) < 100);
    if (shelf === "finished") list = list.filter((item) => getLibraryProgress(item) >= 100);
    if (shelf === "favorites") list = list.filter(isFavorite);
    if (shelf === "pinned") list = list.filter((item) => organization[item.id]?.pinned);
    if (shelf === "recommended") {
      const interests = new Set(
        items.filter((item) => getLibraryProgress(item) > 0 || isFavorite(item)).flatMap(itemTags),
      );
      list = list
        .filter((item) => getLibraryProgress(item) === 0)
        .sort((a, b) => {
          const score = (item: LibraryItem) =>
            (isFavorite(item) ? 3 : 0) +
            itemTags(item).reduce((total, tag) => total + (interests.has(tag) ? 1 : 0), 0);
          return (
            score(b) - score(a) ||
            (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0)
          );
        });
    }
    if (filter !== "All items") {
      list = list.filter((x) => {
        const t = x.type.toUpperCase();
        if (filter === "Books") return ["EPUB", "MOBI", "BOOK"].includes(t);
        if (filter === "PDF") return t === "PDF";
        if (filter === "PPTX") return ["PPTX", "PPT", "SLIDES"].includes(t);
        if (filter === "DOCX") return ["DOCX", "DOC", "TXT", "MD"].includes(t);
        return t === filter.toUpperCase();
      });
    }
    if (sort === "title") list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "progress")
      list.sort((a, b) => getLibraryProgress(b) - getLibraryProgress(a));
    return list;
  }, [items, organization, query, filter, shelf, sort]);

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">LIBRARY / ALL ITEMS</span>
          <h1>My Library</h1>
          <p>
            {items.length} item{items.length !== 1 ? "s" : ""} in your personal collection
          </p>
        </div>
        <button className="primary" onClick={openImport}>
          <Upload size={16} /> Import files
        </button>
      </div>
      <div className="library-tools">
        <label className="field-search">
          <Search size={16} />
          <input
            placeholder={`Search ${items.length} items...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="filter-pills">
          {["All items", "Books", "PDF", "PPTX", "DOCX"].map((x) => (
            <button className={filter === x ? "selected" : ""} onClick={() => setFilter(x)} key={x}>
              {x}
            </button>
          ))}
        </div>
        {organizationNotice && (
          <p className="library-organization-notice" role="status">
            {organizationNotice}
          </p>
        )}
        <nav className="library-shelves" aria-label="Smart shelves">
          {(
            [
              ["all", "All", items.length],
              [
                "reading",
                "Currently reading",
                items.filter(
                  (item) => getLibraryProgress(item) > 0 && getLibraryProgress(item) < 100,
                ).length,
              ],
              [
                "finished",
                "Finished",
                items.filter((item) => getLibraryProgress(item) >= 100).length,
              ],
              ["favorites", "Favorites", items.filter(isFavorite).length],
              ["pinned", "Pinned", items.filter((item) => organization[item.id]?.pinned).length],
              [
                "recommended",
                "Recommended next",
                items.filter((item) => getLibraryProgress(item) === 0).length,
              ],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              className={shelf === key ? "active" : ""}
              onClick={() => setShelf(key)}
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </nav>
        <button
          className="select-btn"
          onClick={() =>
            setSort(sort === "recent" ? "title" : sort === "title" ? "progress" : "recent")
          }
        >
          {sort === "recent" ? "Recently added" : sort === "title" ? "Title (A–Z)" : "Progress"}{" "}
          <ChevronDown size={14} />
        </button>
        <div className="view-toggle">
          <button className={grid ? "active" : ""} onClick={() => setGrid(true)}>
            <Grid2X2 size={15} />
          </button>
          <button className={!grid ? "active" : ""} onClick={() => setGrid(false)}>
            <List size={16} />
          </button>
        </div>
      </div>

      {loadingItems ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "40px 0",
            color: "#888",
          }}
        >
          <Loader2 size={18} className="spin" /> Loading library...
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state" style={{ padding: "60px 0", textAlign: "center" }}>
          {query || filter !== "All items" ? (
            <>
              <Search size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ color: "#888" }}>No items match your search.</p>
              <button
                className="secondary"
                onClick={() => {
                  setQuery("");
                  setFilter("All items");
                }}
                style={{ marginTop: 12 }}
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <Upload size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ color: "#888" }}>Your library is empty. Import your first file!</p>
              <button className="primary" onClick={openImport} style={{ marginTop: 12 }}>
                <Upload size={15} /> Import files
              </button>
            </>
          )}
        </div>
      ) : grid ? (
        <div className="library-grid">
          {visible.map((item) => (
            <article
              className="library-card library-file-card"
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={`Open ${item.title}`}
              onClick={() => openReader(item)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openReader(item);
                }
              }}
              onContextMenu={(event) => showContextMenu(event, item)}
            >
              <div className="library-file-cover">
                <Cover item={item} />
              </div>
              <div className="library-file-card-header">
                <span className={`library-file-icon cover-${item.tone}`}>
                  <FileText size={22} />
                </span>
                <span className="library-file-type">{item.type}</span>
                <button
                  className={`library-icon-action${isFavorite(item) ? " selected" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void toggleOrganizationFlag(item, "favorite");
                  }}
                  aria-label={isFavorite(item) ? "Remove favorite" : "Add favorite"}
                  title="Favorite"
                >
                  <Star size={15} fill={isFavorite(item) ? "currentColor" : "none"} />
                </button>
                <button
                  className={`library-icon-action${organization[item.id]?.pinned ? " selected" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void toggleOrganizationFlag(item, "pinned");
                  }}
                  aria-label={organization[item.id]?.pinned ? "Unpin item" : "Pin item"}
                  title="Pin"
                >
                  <Bookmark
                    size={15}
                    fill={organization[item.id]?.pinned ? "currentColor" : "none"}
                  />
                </button>
                <button
                  className="more"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                  title={`Delete ${item.title}`}
                  aria-label={`Delete ${item.title}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="library-file-info">
                <h3>{item.title}</h3>
                <p>{item.author || "Unknown author"}</p>
                <small>
                  {item.fileSize || item.type}
                  {item.pdfPageCount ? ` · ${item.pdfPageCount} pages` : ""}
                  {item.metadata?.publish_year ? ` · ${item.metadata.publish_year}` : ""}
                  {item.metadata?.publisher ? ` · ${item.metadata.publisher}` : ""}
                  {item.language && item.language !== "en"
                    ? ` · ${item.language.toUpperCase()}`
                    : ""}
                  {item.created_at || item.uploadedAt
                    ? ` · Added ${formatRelative(item.created_at || item.uploadedAt)}`
                    : ""}
                </small>
                <small className="library-sync-state">
                  {pendingItemIds.includes(item.id)
                    ? "Sync queued · saved on this device"
                    : item.id.startsWith("local-")
                      ? "Saved on this device"
                      : "Cloud library"}
                </small>
                {(organization[item.id]?.collection ||
                  item.collectionName ||
                  organization[item.id]?.tags?.length) && (
                  <div className="library-metadata-tags">
                    {(organization[item.id]?.collection || item.collectionName) && (
                      <span>{organization[item.id]?.collection || item.collectionName}</span>
                    )}
                    {itemTags(item).map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>
                )}
                <button
                  className="library-edit-tags"
                  onClick={(event) => {
                    event.stopPropagation();
                    editOrganization(item);
                  }}
                >
                  Edit collection & tags
                </button>
              </div>
              <div className="library-file-progress">
                <div className="library-file-progress-label">
                  <span>{getLibraryProgress(item) > 0 ? "Reading progress" : "Not started"}</span>
                  <b>{getLibraryProgress(item) > 0 ? `${getLibraryProgress(item)}%` : "—"}</b>
                </div>
                <Progress value={getLibraryProgress(item)} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="table">
          <div className="tr th">
            <span>Title</span>
            <span>Type</span>
            <span>Added</span>
            <span>Progress</span>
            <span />
          </div>
          {visible.map((item) => (
            <div
              className="tr library-row"
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => openReader(item)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openReader(item);
                }
              }}
              onContextMenu={(event) => showContextMenu(event, item)}
            >
              <span className="title-cell">
                <span className="mini-doc">
                  <FileText size={16} />
                </span>
                <span>
                  <b>{item.title}</b>
                  <small>
                    {item.author}
                    {itemTags(item).length
                      ? ` · ${itemTags(item)
                          .map((tag) => `#${tag}`)
                          .join(" ")}`
                      : ""}
                  </small>
                </span>
              </span>
              <span>{item.type}</span>
              <span>{formatDate(item.created_at || item.uploadedAt)}</span>
              <span>{getLibraryProgress(item) > 0 ? `${getLibraryProgress(item)}%` : "—"}</span>
              <span className="library-row-actions">
                <button
                  className={`library-icon-action${isFavorite(item) ? " selected" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleOrganizationFlag(item, "favorite");
                  }}
                  aria-label={isFavorite(item) ? "Remove favorite" : "Add favorite"}
                  title="Favorite"
                >
                  <Star size={14} fill={isFavorite(item) ? "currentColor" : "none"} />
                </button>
                <button
                  className={`library-icon-action${organization[item.id]?.pinned ? " selected" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleOrganizationFlag(item, "pinned");
                  }}
                  aria-label={organization[item.id]?.pinned ? "Unpin item" : "Pin item"}
                  title="Pin"
                >
                  <Bookmark
                    size={14}
                    fill={organization[item.id]?.pinned ? "currentColor" : "none"}
                  />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    editOrganization(item);
                  }}
                  title="Edit collection and tags"
                  aria-label={`Edit ${item.title} collection and tags`}
                >
                  <FolderPlus size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                  title="Delete item"
                  aria-label={`Delete ${item.title}`}
                  style={{
                    padding: "4px 6px",
                    opacity: 0.5,
                    border: 0,
                    background: "transparent",
                    color: "inherit",
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      {contextMenu && (
        <div
          className="library-context-menu"
          role="menu"
          aria-label={`Actions for ${contextMenu.item.title}`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            role="menuitem"
            onClick={() => {
              const item = contextMenu.item;
              setContextMenu(null);
              openReader(item);
            }}
          >
            <BookOpen size={15} /> Open
          </button>
          <button
            className="delete-action"
            role="menuitem"
            onClick={() => {
              const item = contextMenu.item;
              setContextMenu(null);
              onDelete(item.id);
            }}
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      )}
    </main>
  );
}

// ─── Ask Page (Real AI Chat) ──────────────────────────────────────────────────
function AskPage({
  token,
  items,
  onAuthRequired,
}: {
  token: string | null;
  items: LibraryItem[];
  onAuthRequired: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<{ id: string; title: string; date: Date }[]>(
    [],
  );
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [aiContextLimit, setAiContextLimit] = useState(
    () => localStorage.getItem("clio_ai_context") || "5",
  );
  const [compareFirstId, setCompareFirstId] = useState(items[0]?.id || "");
  const [compareSecondId, setCompareSecondId] = useState(items[1]?.id || "");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!compareFirstId && items[0]) setCompareFirstId(items[0].id);
    if ((!compareSecondId || compareSecondId === compareFirstId) && items.length > 1) {
      setCompareSecondId(items.find((item) => item.id !== compareFirstId)?.id || "");
    }
  }, [items, compareFirstId, compareSecondId]);

  const sendMessage = async (text?: string, libraryItemIds?: string[]) => {
    const q = (text || input).trim();
    if (!q) return;
    if (!token || token.startsWith("local-token-")) {
      setError("Sign in to use CLIO Intelligence.");
      onAuthRequired();
      return;
    }

    setInput("");
    setError(null);
    const userMsg: ChatMessage = { role: "user", content: q, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const data = await apiFetch(
        "/ai/chat",
        {
          method: "POST",
          body: JSON.stringify({
            message: q,
            conversation_id: activeConvId,
            context_limit: Number(aiContextLimit),
            library_item_ids: libraryItemIds,
          }),
        },
        token,
      );
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: data.response || data.message || "I could not generate a response.",
        citations: data.sources || data.citations || [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      if (data.conversation_id && !activeConvId) {
        setActiveConvId(data.conversation_id);
        setConversations((prev) => [
          { id: data.conversation_id, title: q.slice(0, 40), date: new Date() },
          ...prev,
        ]);
      }
    } catch (err: any) {
      const message = String(err?.message || "");
      if (/not authenticated|invalid or expired token|unauthorized/i.test(message)) {
        localStorage.removeItem("clio_token");
        setError("Your session expired. Please sign in again to use CLIO Intelligence.");
        onAuthRequired();
      } else {
        setError(message || "Failed to get AI response");
      }
    } finally {
      setLoading(false);
    }
  };

  const startNew = () => {
    setMessages([]);
    setActiveConvId(null);
    setError(null);
    setInput("");
    inputRef.current?.focus();
  };

  const prompts =
    items.length > 0
      ? [
          `Summarise "${items[0]?.title}"`,
          "What are the key themes across my library?",
          "Find connections between my documents",
          "Create a study plan from my materials",
        ]
      : [
          "How does CLIO's AI work?",
          "What file types can I import?",
          "How do I organise my library?",
          "What is the best way to take notes while reading?",
        ];

  return (
    <main className="page ask-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CLIO INTELLIGENCE</span>
          <h1>Ask Your Library</h1>
          <p>Find answers across everything you've read.</p>
        </div>
        <button className="secondary" onClick={startNew}>
          <Plus size={15} /> New conversation
        </button>
      </div>
      <div className="chat-shell">
        <aside className="chat-history">
          <span className="eyebrow">RECENT</span>
          {conversations.length === 0 ? (
            <p style={{ color: "#888", fontSize: 12, padding: "8px 0" }}>
              Your conversations will appear here.
            </p>
          ) : (
            conversations.map((c) => (
              <button
                className={c.id === activeConvId ? "active" : ""}
                key={c.id}
                onClick={() => {
                  setActiveConvId(c.id);
                }}
              >
                <MessageSquareText size={15} />
                <span>
                  {c.title}
                  <small>{formatRelative(c.date.toISOString())}</small>
                </span>
              </button>
            ))
          )}
        </aside>
        <section className="chat-main">
          {messages.length === 0 ? (
            <div className="ask-empty">
              <span className="ai-mark">
                <Sparkles size={24} />
              </span>
              <h2>What would you like to understand?</h2>
              <p>
                {token
                  ? items.length > 0
                    ? "Ask a question and CLIO will search across your books, documents, presentations, highlights, and notes."
                    : "Import documents first, then ask questions about them."
                  : "Sign in to unlock AI-powered search across your library."}
              </p>
              <div className="prompt-grid">
                {prompts.map((x) => (
                  <button key={x} onClick={() => sendMessage(x)}>
                    {x}
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
              {items.length > 1 && (
                <div className="compare-documents">
                  <div>
                    <b>Compare two documents</b>
                    <small>
                      Ask CLIO to find shared themes, differences, and useful connections.
                    </small>
                  </div>
                  <select
                    value={compareFirstId}
                    onChange={(event) => setCompareFirstId(event.target.value)}
                    aria-label="First document to compare"
                  >
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={compareSecondId}
                    onChange={(event) => setCompareSecondId(event.target.value)}
                    aria-label="Second document to compare"
                  >
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  <button
                    className="primary"
                    disabled={
                      !compareFirstId ||
                      !compareSecondId ||
                      compareFirstId === compareSecondId ||
                      !token
                    }
                    onClick={() => {
                      const first = items.find((item) => item.id === compareFirstId);
                      const second = items.find((item) => item.id === compareSecondId);
                      if (first && second)
                        sendMessage(
                          `Compare "${first.title}" with "${second.title}". Explain their shared themes, key differences, complementary ideas, and cite the source for each point.`,
                          [first.id, second.id],
                        );
                    }}
                  >
                    <Network size={14} /> Compare books
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="answer">
              {messages.map((msg, i) =>
                msg.role === "user" ? (
                  <div className="user-message" key={i}>
                    {msg.content}
                  </div>
                ) : (
                  <div className="ai-answer" key={i}>
                    <span className="ai-mark small">
                      <Sparkles size={16} />
                    </span>
                    <div>
                      <div className="ai-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="citations">
                          {msg.citations.map((c, ci) => (
                            <button key={ci}>
                              <b>{ci + 1}</b> {c.title}
                              {c.chunk ? ` · "${c.chunk.slice(0, 50)}…"` : ""}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="answer-actions">
                        <button onClick={() => navigator.clipboard?.writeText(msg.content)}>
                          <Download size={14} /> Copy
                        </button>
                        <button onClick={() => sendMessage(input)}>
                          <RotateCcw size={14} /> Regenerate
                        </button>
                      </div>
                    </div>
                  </div>
                ),
              )}
              {loading && (
                <div className="ai-answer">
                  <span className="ai-mark small">
                    <Sparkles size={16} />
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#888" }}>
                    <Loader2 size={16} className="spin" /> Thinking…
                  </div>
                </div>
              )}
              {error && (
                <div style={{ padding: "12px 16px", color: "#ef4444", fontSize: 13 }}>
                  ⚠ {error}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
          <div className="composer">
            <div className="scope">
              <button>
                <Library size={14} /> Entire library <ChevronDown size={13} />
              </button>
            </div>
            <div>
              <input
                ref={inputRef}
                placeholder={
                  token ? "Ask anything about your library..." : "Sign in to ask questions..."
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !loading) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={loading || !token}
              />
              <button
                className="send"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim() || !token}
              >
                {loading ? <Loader2 size={17} className="spin" /> : <ArrowRight size={17} />}
              </button>
            </div>
            <small>
              {token
                ? "CLIO cites the sources it uses. Verify important information."
                : "Sign in to use AI-powered library search."}
            </small>
          </div>
        </section>
      </div>
    </main>
  );
}

// ─── Reader ───────────────────────────────────────────────────────────────────
const sampleChapters: Chapter[] = [
  {
    id: 1,
    title: "Document Overview",
    subtitle: "Imported document",
    pageStart: 1,
    lead: "This document has been added to your CLIO library.",
    paragraphs: [
      "Open any text file (TXT, MD, HTML) to read its full content here with chapter navigation.",
      "For binary formats such as PDF, DOCX, EPUB, and PPTX, text extraction requires the backend extractor service to be running.",
      "You can add notes, highlights, and bookmarks to any document in your library.",
    ],
  },
];

function Reader({
  close,
  book,
  token,
}: {
  close: () => void;
  book?: LibraryItem;
  token: string | null;
}) {
  if (!book) return null;
  const activeDoc = book;
  const isPdf = activeDoc.type.toLowerCase() === "pdf";
  const chapters: Chapter[] =
    activeDoc.chapters && activeDoc.chapters.length > 0
      ? activeDoc.chapters
      : activeDoc.metadata?.chapters && activeDoc.metadata.chapters.length > 0
        ? activeDoc.metadata.chapters
        : activeDoc.content
          ? buildDownloadedTextChapters(activeDoc.content, activeDoc.title)
          : sampleChapters;

  const [toc, setToc] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(max-width: 700px)").matches,
  );
  const [overviewCollapsed, setOverviewCollapsed] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(
    () => (getReaderPosition(activeDoc.id)?.page || 1) - 1,
  );
  const [pdfPageCount, setPdfPageCount] = useState(activeDoc.pdfPageCount || 0);
  const pdfPageRef = useRef<HTMLDivElement>(null);
  const bookPageRef = useRef<HTMLElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastSwipeAtRef = useRef(0);
  const lastControlsRevealRef = useRef(0);
  const readerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const [notesOpen, setNotesOpen] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(max-width: 700px)").matches,
  );
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [bookmarkedPages, setBookmarkedPages] = useState<number[]>([]);
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false);
  const [filterMode, setFilterMode] = useState<"chapter" | "all">("chapter");
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`clio_local_notes_${activeDoc.id}`) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      console.warn("Unable to load locally saved notes:", error);
      return [];
    }
  });
  const [savingNote, setSavingNote] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [readerFont, setReaderFont] = useState(
    () => localStorage.getItem("clio_reader_font") || "Georgia",
  );
  const [readerFontSize, setReaderFontSize] = useState(() => {
    const saved = localStorage.getItem("clio_reader_font_size");
    return saved ? parseInt(saved, 10) : 16;
  });
  const [readerLineHeight, setReaderLineHeight] = useState(1.85);
  const [readerTheme, setReaderTheme] = useState<"paper" | "sepia" | "dark" | "contrast">("paper");
  const [pdfViewMode, setPdfViewMode] = useState<"canvas" | "text">(
    () => getReaderPosition(activeDoc.id)?.viewMode || "canvas",
  );
  const [pdfZoom, setPdfZoom] = useState(() => getReaderPosition(activeDoc.id)?.zoom || 1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [loadedPreferenceKey, setLoadedPreferenceKey] = useState("");
  const [loadedPositionKey, setLoadedPositionKey] = useState("");
  const [readerAiResult, setReaderAiResult] = useState<{ title: string; content: string } | null>(
    null,
  );
  const [readerAiLoading, setReaderAiLoading] = useState(false);
  const [readerAiError, setReaderAiError] = useState("");

  // APK Upgrades
  const [isTtsActive, setIsTtsActive] = useState(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ page: number; snippet: string }[]>([]);
  const [showJumpModal, setShowJumpModal] = useState(false);
  const [jumpTargetPage, setJumpTargetPage] = useState(1);

  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(12);
      } catch {}
    }
  }, []);

  const totalSections = isPdf ? pdfPageCount || activeDoc.pdfPageCount || 1 : chapters.length;
  const safeChapterIndex = Math.min(currentChapterIndex, Math.max(0, totalSections - 1));
  const chapter = chapters[safeChapterIndex] || chapters[0];
  const progressPercent = Math.round(((safeChapterIndex + 1) / Math.max(1, totalSections)) * 100);
  const currentPageNumber = safeChapterIndex + 1;
  const bookmarked = bookmarkedPages.includes(currentPageNumber);
  const bookmarkStorageKey = `clio_bookmarks_${activeDoc.id}`;
  const updatePdfPageCount = useCallback((count: number) => setPdfPageCount(count), []);
  const goToPdfPage = useCallback((page: number) => {
    setCurrentChapterIndex(page - 1);
  }, []);

  const askReaderAi = useCallback(
    async (action: "explain" | "summarize" | "flashcards" | "quiz" | "extract") => {
      if (!token || token.startsWith("local-token-")) {
        setReaderAiError("Sign in to use CLIO Intelligence.");
        setReaderAiResult({
          title: "CLIO Intelligence",
          content: "Sign in to analyze this document with AI.",
        });
        return;
      }
      setReaderAiLoading(true);
      setReaderAiError("");
      setReaderAiResult(null);
      try {
        let result: unknown;
        if (action === "summarize") {
          result = await apiFetch(
            "/ai/summarize",
            {
              method: "POST",
              body: JSON.stringify({ library_item_id: activeDoc.id, length: "short" }),
            },
            token,
          );
        } else if (action === "flashcards" || action === "quiz") {
          result = await apiFetch(
            "/ai/flashcards",
            {
              method: "POST",
              body: JSON.stringify({
                library_item_id: activeDoc.id,
                count: action === "quiz" ? 3 : 5,
              }),
            },
            token,
          );
        } else {
          const selected = window.getSelection()?.toString().trim();
          const passage =
            selected ||
            [chapter?.lead, ...(chapter?.paragraphs || [])]
              .filter(Boolean)
              .join(" ")
              .slice(0, 1800);
          const response = await apiFetch(
            "/ai/chat",
            {
              method: "POST",
              body: JSON.stringify({
                message:
                  action === "extract"
                    ? `Analyze "${activeDoc.title}" and extract a concise, clearly labeled list of key people, concepts, dates, and notable quotations from the document. Distinguish facts from interpretation.`
                    : `Explain this passage from "${activeDoc.title}", page ${currentPageNumber}. Explain clearly and give one related idea:\n\n${passage}`,
                library_item_ids: [activeDoc.id],
                context_limit: 3,
              }),
            },
            token,
          );
          result = response.response || response.message;
        }
        const content = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        setReaderAiResult({
          title:
            action === "explain"
              ? "Passage explanation"
              : action === "summarize"
                ? "Document summary"
                : action === "quiz"
                  ? "Quick quiz"
                  : action === "extract"
                    ? "Key details"
                    : "Study flashcards",
          content: content || "CLIO couldn't generate a result.",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to complete this AI action.";
        setReaderAiError(message);
        setReaderAiResult({ title: "CLIO Intelligence", content: message });
      } finally {
        setReaderAiLoading(false);
      }
    },
    [activeDoc.id, activeDoc.title, chapter, currentPageNumber, token],
  );

  useEffect(() => {
    if (
      !token ||
      token.startsWith("local-token-") ||
      localStorage.getItem("clio_auto_sync") === "false"
    )
      return;
    const progressPath = `/library/${encodeURIComponent(activeDoc.id)}/progress`;
    const progressBody = JSON.stringify({
      current_page: currentPageNumber,
      total_pages: totalSections,
      progress_percentage: progressPercent,
    });
    const timer = window.setTimeout(() => {
      apiFetch(progressPath, { method: "POST", body: progressBody }, token).catch((error) => {
        console.warn("Unable to sync reading progress; keeping it queued for retry:", error);
        try {
          queueOfflineSyncAction({
            itemId: activeDoc.id,
            path: progressPath,
            method: "POST",
            body: progressBody,
          });
          window.dispatchEvent(new Event("clio-sync-queued"));
        } catch (queueError) {
          console.error("Unable to queue reading progress for sync:", queueError);
        }
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeDoc.id, currentPageNumber, progressPercent, token, totalSections]);

  useEffect(() => {
    const key = `clio_reading_position_${activeDoc.id}`;
    setLoadedPositionKey("");
    const saved = getReaderPosition(activeDoc.id);
    if (saved) {
      setCurrentChapterIndex(Math.min(saved.page - 1, Math.max(0, totalSections - 1)));
      setPdfViewMode(saved.viewMode);
      setPdfZoom(saved.zoom);
      requestAnimationFrame(() => {
        if (bookPageRef.current && saved.viewMode === "text")
          bookPageRef.current.scrollTop = saved.scrollTop;
      });
    } else {
      setCurrentChapterIndex(0);
      setPdfViewMode("canvas");
    }
    setLoadedPositionKey(key);
  }, [activeDoc.id, totalSections]);

  useEffect(() => {
    const key = `clio_reading_position_${activeDoc.id}`;
    if (loadedPositionKey !== key) return;
    const scrollTop = pdfViewMode === "text" ? bookPageRef.current?.scrollTop || 0 : 0;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          page: currentPageNumber,
          total: totalSections,
          scrollTop,
          viewMode: pdfViewMode,
          zoom: pdfZoom,
          progress: progressPercent,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      console.error("Unable to save the current reading position:", error);
    }
  }, [activeDoc.id, currentPageNumber, loadedPositionKey, pdfViewMode, pdfZoom]);

  useEffect(() => {
    if (pdfViewMode !== "text" || loadedPositionKey !== `clio_reading_position_${activeDoc.id}`)
      return;
    const page = bookPageRef.current;
    if (!page) return;
    let timer = 0;
    const saveScrollPosition = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        try {
          const saved = getReaderPosition(activeDoc.id);
          localStorage.setItem(
            `clio_reading_position_${activeDoc.id}`,
            JSON.stringify({
              ...saved,
              page: currentPageNumber,
              total: totalSections,
              progress: progressPercent,
              scrollTop: page.scrollTop,
              viewMode: pdfViewMode,
              zoom: pdfZoom,
              updatedAt: new Date().toISOString(),
            }),
          );
        } catch (error) {
          console.error("Unable to save the reader scroll position:", error);
        }
      }, 180);
    };
    page.addEventListener("scroll", saveScrollPosition, { passive: true });
    return () => {
      window.clearTimeout(timer);
      page.removeEventListener("scroll", saveScrollPosition);
    };
  }, [
    activeDoc.id,
    currentPageNumber,
    loadedPositionKey,
    pdfViewMode,
    pdfZoom,
    progressPercent,
    totalSections,
  ]);

  useEffect(() => {
    const activityKey = "clio_reading_activity";
    try {
      const saved = JSON.parse(localStorage.getItem(activityKey) || "[]");
      const activity = Array.isArray(saved) ? saved : [];
      const today = new Date().toISOString().slice(0, 10);
      const uniqueKey = `${today}:${activeDoc.id}:${currentPageNumber}`;
      if (!activity.some((entry: { key?: string }) => entry?.key === uniqueKey)) {
        activity.unshift({
          key: uniqueKey,
          date: today,
          itemId: activeDoc.id,
          title: activeDoc.title,
          page: currentPageNumber,
          timestamp: Date.now(),
        });
        localStorage.setItem(activityKey, JSON.stringify(activity.slice(0, 500)));
      }
    } catch (error) {
      console.warn("Unable to record local reading activity:", error);
    }
  }, [activeDoc.id, activeDoc.title, currentPageNumber]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const key = "clio_reading_time_by_day";
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "{}");
        const totals = saved && typeof saved === "object" ? (saved as Record<string, number>) : {};
        const day = new Date().toISOString().slice(0, 10);
        localStorage.setItem(key, JSON.stringify({ ...totals, [day]: (totals[day] || 0) + 30 }));
      } catch (error) {
        console.warn("Unable to record reading time:", error);
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setBookmarksLoaded(false);
    try {
      const saved = localStorage.getItem(bookmarkStorageKey);
      const pages: unknown = saved ? JSON.parse(saved) : [];
      setBookmarkedPages(
        Array.isArray(pages)
          ? pages.filter((page): page is number => Number.isInteger(page) && page > 0)
          : [],
      );
    } catch (error) {
      console.error("Unable to load saved page bookmarks", error);
      setBookmarkedPages([]);
    } finally {
      setBookmarksLoaded(true);
    }
  }, [bookmarkStorageKey]);

  useEffect(() => {
    if (!bookmarksLoaded) return;
    try {
      localStorage.setItem(bookmarkStorageKey, JSON.stringify(bookmarkedPages));
    } catch (error) {
      console.error("Unable to save page bookmarks", error);
    }
  }, [bookmarkStorageKey, bookmarkedPages, bookmarksLoaded]);

  useEffect(() => {
    const handlePageArrow = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (
        event.target instanceof HTMLElement &&
        /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)
      )
        return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (safeChapterIndex < totalSections - 1) {
          if (isPdf) goToPdfPage(safeChapterIndex + 2);
          else setCurrentChapterIndex(safeChapterIndex + 1);
        }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (safeChapterIndex > 0) {
          if (isPdf) goToPdfPage(safeChapterIndex);
          else setCurrentChapterIndex(safeChapterIndex - 1);
        }
      }
    };
    window.addEventListener("keydown", handlePageArrow);
    return () => window.removeEventListener("keydown", handlePageArrow);
  }, [goToPdfPage, isPdf, safeChapterIndex, totalSections]);

  useEffect(() => {
    if (!isPdf && bookPageRef.current) bookPageRef.current.scrollTop = 0;
  }, [isPdf, safeChapterIndex]);

  const handlePdfTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const touch = event.changedTouches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handlePdfTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return;
    lastSwipeAtRef.current = Date.now();
    if (deltaX < 0) turnPage(1);
    if (deltaX > 0) turnPage(-1);
  };

  const toggleCurrentBookmark = () => {
    setBookmarkedPages((pages) =>
      bookmarked
        ? pages.filter((page) => page !== currentPageNumber)
        : [...pages, currentPageNumber].sort((a, b) => a - b),
    );
  };

  useEffect(() => {
    const handleReaderShortcut = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (
        event.target instanceof HTMLElement &&
        /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target.tagName)
      )
        return;
      if (event.key === "Home") {
        event.preventDefault();
        isPdf && pdfViewMode === "canvas" ? goToPdfPage(1) : setCurrentChapterIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        isPdf && pdfViewMode === "canvas"
          ? goToPdfPage(totalSections)
          : setCurrentChapterIndex(totalSections - 1);
      } else if (event.key.toLowerCase() === "b") {
        toggleCurrentBookmark();
      } else if (event.key === "+" || event.key === "=") {
        setReaderFontSize((size) => Math.min(26, size + 1));
      } else if (event.key === "-") {
        setReaderFontSize((size) => Math.max(12, size - 1));
      }
    };
    window.addEventListener("keydown", handleReaderShortcut);
    return () => window.removeEventListener("keydown", handleReaderShortcut);
  }, [goToPdfPage, isPdf, pdfViewMode, totalSections, toggleCurrentBookmark]);

  // Sync jump target page with current page
  useEffect(() => {
    setJumpTargetPage(currentPageNumber);
  }, [currentPageNumber]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("#reader-settings-menu") &&
        !target.closest("#reader-more-menu") &&
        !target.closest(".reader-control")
      ) {
        setShowSettingsMenu(false);
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Text-To-Speech implementation
  const stopTts = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsTtsPlaying(false);
    setIsTtsActive(false);
  }, []);

  const turnPage = useCallback(
    (direction: -1 | 1) => {
      const nextIndex = Math.max(0, Math.min(totalSections - 1, safeChapterIndex + direction));
      if (nextIndex === safeChapterIndex) return;
      triggerHaptic();
      if (isPdf && pdfViewMode === "canvas") goToPdfPage(nextIndex + 1);
      else setCurrentChapterIndex(nextIndex);
      setHighlight(false);
    },
    [goToPdfPage, isPdf, pdfViewMode, safeChapterIndex, totalSections, triggerHaptic],
  );

  const startTtsForCurrentPage = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-speech audio narration is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const textToRead = chapter?.paragraphs?.join(" ") || chapter?.lead || activeDoc.title;
    if (!textToRead.trim()) return;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = ttsSpeed;
    utterance.onend = () => {
      if (safeChapterIndex < totalSections - 1) {
        turnPage(1);
      } else {
        setIsTtsPlaying(false);
        setIsTtsActive(false);
      }
    };
    utterance.onerror = () => {
      setIsTtsPlaying(false);
    };

    window.speechSynthesis.speak(utterance);
    setIsTtsActive(true);
    setIsTtsPlaying(true);
    triggerHaptic();
  }, [
    chapter,
    activeDoc.title,
    ttsSpeed,
    safeChapterIndex,
    totalSections,
    turnPage,
    triggerHaptic,
  ]);

  const toggleTtsPlayPause = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (isTtsPlaying) {
      window.speechSynthesis.pause();
      setIsTtsPlaying(false);
    } else {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsTtsPlaying(true);
      } else {
        startTtsForCurrentPage();
      }
    }
    triggerHaptic();
  }, [isTtsPlaying, startTtsForCurrentPage, triggerHaptic]);

  useEffect(() => {
    if (isTtsActive && isTtsPlaying) {
      startTtsForCurrentPage();
    }
  }, [safeChapterIndex]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Search across document
  useEffect(() => {
    if (!searchQuery.trim() || !showSearchModal) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results: { page: number; snippet: string }[] = [];
    chapters.forEach((ch, idx) => {
      const pageNum = ch.pageStart || idx + 1;
      const allText = [ch.title, ch.subtitle, ch.lead, ...(ch.paragraphs || [])]
        .filter(Boolean)
        .join(" ");
      const matchIdx = allText.toLowerCase().indexOf(q);
      if (matchIdx !== -1) {
        const start = Math.max(0, matchIdx - 35);
        const end = Math.min(allText.length, matchIdx + q.length + 55);
        const snippet =
          (start > 0 ? "…" : "") + allText.slice(start, end) + (end < allText.length ? "…" : "");
        results.push({ page: pageNum, snippet });
      }
    });
    setSearchResults(results.slice(0, 40));
  }, [searchQuery, showSearchModal, chapters]);

  // Estimated reading time
  const currentWords = (chapter?.paragraphs?.join(" ") || chapter?.lead || "")
    .split(/\s+/)
    .filter(Boolean).length;
  const minutesLeftInChapter = Math.max(1, Math.ceil(currentWords / 200));

  const enterFullscreen = async () => {
    setShowMoreMenu(false);
    setControlsVisible(true);
    setToc(false);
    setNotesOpen(false);
    setIsFullscreen(true);
    try {
      await readerRef.current?.requestFullscreen?.();
    } catch (error) {
      console.error("Native fullscreen is unavailable; using immersive reader mode", error);
    }
  };

  const exitFullscreen = async () => {
    setControlsVisible(true);
    if (document.fullscreenElement === readerRef.current) {
      try {
        await document.exitFullscreen();
      } catch (error) {
        console.error("Unable to exit native fullscreen", error);
      }
    }
    setIsFullscreen(false);
  };

  const closeReader = async () => {
    if (isFullscreen) await exitFullscreen();
    close();
  };

  const revealFullscreenControls = () => {
    if (!isFullscreen) return;
    setControlsVisible(true);
    if (controlsTimerRef.current !== null) window.clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = window.setTimeout(() => {
      if (!showMoreMenu && !showSettingsMenu) setControlsVisible(false);
    }, 3500);
  };

  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current !== null) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimerRef.current !== null) {
        window.clearTimeout(controlsTimerRef.current);
      }
    };
  }, [resetControlsTimer]);

  const handleReaderTap = (event: React.MouseEvent<HTMLElement>) => {
    if (Date.now() - lastSwipeAtRef.current < 500) return;
    if (Date.now() - lastControlsRevealRef.current < 400) return;
    if (!(event.target instanceof Element)) return;

    if (toc || notesOpen) {
      if (!event.target.closest(".toc, .reader-notes, .reader-control, .icon-btn")) {
        setToc(false);
        setNotesOpen(false);
        return;
      }
    }

    if (
      event.target.closest(
        "button, input, textarea, select, a, .reader-dropdown-menu, .toc, .reader-notes",
      )
    )
      return;

    // If controls are hidden, tapping reveals them and they stay expanded
    if (!controlsVisible) {
      setControlsVisible(true);
      lastControlsRevealRef.current = Date.now();
      if (controlsTimerRef.current !== null) {
        window.clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const position = (event.clientX - bounds.left) / bounds.width;

    if (position < 0.22) {
      turnPage(-1);
    } else if (position > 0.78) {
      turnPage(1);
    } else if (isFullscreen) {
      setControlsVisible((visible) => !visible);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const nativeFullscreen = document.fullscreenElement === readerRef.current;
      if (!nativeFullscreen && isFullscreen && document.fullscreenElement) return;
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
        setControlsVisible(true);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) {
        setIsFullscreen(false);
        setControlsVisible(true);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      setControlsVisible(true);
      if (controlsTimerRef.current !== null) window.clearTimeout(controlsTimerRef.current);
      return;
    }
    revealFullscreenControls();
    return () => {
      if (controlsTimerRef.current !== null) window.clearTimeout(controlsTimerRef.current);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (showMoreMenu || showSettingsMenu) {
      if (controlsTimerRef.current !== null) window.clearTimeout(controlsTimerRef.current);
      setControlsVisible(true);
    } else if (isFullscreen) {
      revealFullscreenControls();
    }
  }, [isFullscreen, showMoreMenu, showSettingsMenu]);

  useEffect(() => {
    const key = `clio_reader_preferences_${activeDoc.id}`;
    setLoadedPreferenceKey("");
    setReaderFont(localStorage.getItem("clio_reader_font") || "Georgia");
    const savedFontSize = Number(localStorage.getItem("clio_reader_font_size"));
    setReaderFontSize(
      Number.isFinite(savedFontSize) ? Math.min(26, Math.max(12, savedFontSize)) : 16,
    );
    setReaderLineHeight(1.85);
    const defaultTheme = localStorage.getItem("clio_reader_theme_default");
    setReaderTheme(
      defaultTheme === "sepia" || defaultTheme === "dark" || defaultTheme === "contrast"
        ? defaultTheme
        : "paper",
    );
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const preferences = JSON.parse(saved);
        if (typeof preferences.font === "string") setReaderFont(preferences.font);
        if (typeof preferences.fontSize === "number")
          setReaderFontSize(Math.min(26, Math.max(12, preferences.fontSize)));
        if ([1.5, 1.85, 2.2].includes(preferences.lineHeight))
          setReaderLineHeight(preferences.lineHeight);
        if (
          preferences.theme === "paper" ||
          preferences.theme === "sepia" ||
          preferences.theme === "dark" ||
          preferences.theme === "contrast"
        ) {
          setReaderTheme(preferences.theme);
        }
      }
    } catch (error) {
      console.error("Unable to load reader preferences", error);
    } finally {
      setLoadedPreferenceKey(key);
    }
  }, [activeDoc.id]);

  useEffect(() => {
    const key = `clio_reader_preferences_${activeDoc.id}`;
    if (loadedPreferenceKey !== key) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          font: readerFont,
          fontSize: readerFontSize,
          lineHeight: readerLineHeight,
          theme: readerTheme,
        }),
      );
      localStorage.setItem("clio_reader_font", readerFont);
      localStorage.setItem("clio_reader_font_size", String(readerFontSize));
    } catch (error) {
      console.error("Unable to save reader preferences", error);
    }
  }, [
    activeDoc.id,
    loadedPreferenceKey,
    readerFont,
    readerFontSize,
    readerLineHeight,
    readerTheme,
  ]);

  // Load annotations from backend
  useEffect(() => {
    if (!activeDoc?.id) return;
    const readLocalNotes = (): Note[] => {
      try {
        const saved = JSON.parse(localStorage.getItem(`clio_local_notes_${activeDoc.id}`) || "[]");
        return Array.isArray(saved) ? saved : [];
      } catch (error) {
        console.warn("Unable to load locally saved notes:", error);
        return [];
      }
    };
    setNotes(readLocalNotes());
    if (!token || token.startsWith("local-token-")) return;
    const refreshNotes = () =>
      apiFetch(`/library/${encodeURIComponent(activeDoc.id)}/notes`, {}, token)
        .then((data) => {
          if (Array.isArray(data)) {
            const remoteNotes: Note[] = data.map((n: any) => ({
              id: n.id || n._id,
              chapterId: n.chapter_index ?? 1,
              text: n.text || n.content,
              page: n.page ?? 1,
              createdAt: formatRelative(n.created_at),
              isHighlight: n.is_highlight ?? false,
            }));
            setNotes([
              ...remoteNotes,
              ...readLocalNotes().filter((note) => note.id.startsWith("local-")),
            ]);
          }
        })
        .catch((error) =>
          console.warn("Unable to refresh notes from CLIO; showing saved device notes:", error),
        );
    void refreshNotes();
    window.addEventListener("clio-sync-complete", refreshNotes);
    return () => window.removeEventListener("clio-sync-complete", refreshNotes);
  }, [activeDoc?.id, token]);

  const visibleNotes = useMemo(() => {
    if (filterMode === "all") return notes;
    return isPdf
      ? notes.filter((n) => n.page === safeChapterIndex + 1)
      : notes.filter((n) => n.chapterId === chapter.id);
  }, [notes, filterMode, isPdf, safeChapterIndex, chapter.id]);

  const handleSaveNote = async () => {
    if (!newNoteText.trim()) return;
    setSavingNote(true);
    const payload = {
      text: newNoteText.trim(),
      chapter_index: safeChapterIndex,
      page: isPdf ? safeChapterIndex + 1 : chapter.pageStart || 1,
      is_highlight: false,
    };
    try {
      let saved: any = { id: `local-${Date.now()}` };
      if (token && activeDoc?.id) {
        saved = await apiFetch(
          `/library/${activeDoc.id}/notes`,
          { method: "POST", body: JSON.stringify(payload) },
          token,
        );
      }
      const newNote: Note = {
        id: saved.id || saved._id || `local-${Date.now()}`,
        chapterId: isPdf ? safeChapterIndex + 1 : chapter.id,
        text: newNoteText.trim(),
        page: isPdf ? safeChapterIndex + 1 : chapter.pageStart || 1,
        createdAt: "Just now",
        isHighlight: false,
      };
      setNotes([newNote, ...notes]);
      if (newNote.id.startsWith("local-")) {
        try {
          const localNotes = JSON.parse(
            localStorage.getItem(`clio_local_notes_${activeDoc.id}`) || "[]",
          );
          localStorage.setItem(
            `clio_local_notes_${activeDoc.id}`,
            JSON.stringify([newNote, ...(Array.isArray(localNotes) ? localNotes : [])]),
          );
        } catch (storageError) {
          console.error("Unable to save this note on the device:", storageError);
        }
      }
      setNewNoteText("");
      setIsAddingNote(false);
    } catch (syncError) {
      console.warn("Note sync is unavailable; saving the note for offline use:", syncError);
      const newNote: Note = {
        id: `local-${Date.now()}`,
        chapterId: isPdf ? safeChapterIndex + 1 : chapter.id,
        text: newNoteText.trim(),
        page: isPdf ? safeChapterIndex + 1 : chapter.pageStart || 1,
        createdAt: "Just now",
        isHighlight: false,
      };
      setNotes([newNote, ...notes]);
      try {
        const localNotes = JSON.parse(
          localStorage.getItem(`clio_local_notes_${activeDoc.id}`) || "[]",
        );
        localStorage.setItem(
          `clio_local_notes_${activeDoc.id}`,
          JSON.stringify([newNote, ...(Array.isArray(localNotes) ? localNotes : [])]),
        );
        if (token && !token.startsWith("local-token-")) {
          queueOfflineSyncAction({
            itemId: activeDoc.id,
            path: `/library/${encodeURIComponent(activeDoc.id)}/notes`,
            method: "POST",
            body: JSON.stringify(payload),
            localNoteId: newNote.id,
          });
          window.dispatchEvent(new Event("clio-sync-queued"));
        }
      } catch (storageError) {
        console.error("Unable to save this note for offline sync:", storageError);
      }
      setNewNoteText("");
      setIsAddingNote(false);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setNotes(notes.filter((n) => n.id !== noteId));
    try {
      const localNotes = JSON.parse(
        localStorage.getItem(`clio_local_notes_${activeDoc.id}`) || "[]",
      );
      localStorage.setItem(
        `clio_local_notes_${activeDoc.id}`,
        JSON.stringify(
          (Array.isArray(localNotes) ? localNotes : []).filter((note: Note) => note.id !== noteId),
        ),
      );
    } catch (error) {
      console.error("Unable to update locally saved notes:", error);
    }
    if (token && !noteId.startsWith("local-")) {
      try {
        await apiFetch(`/library/notes/${noteId}`, { method: "DELETE" }, token);
      } catch (error) {
        console.warn("Unable to delete the remote note; queueing for sync:", error);
        try {
          queueOfflineSyncAction({
            itemId: activeDoc.id,
            path: `/library/notes/${encodeURIComponent(noteId)}`,
            method: "DELETE",
          });
          window.dispatchEvent(new Event("clio-sync-queued"));
        } catch (queueError) {
          console.error("Unable to queue note deletion:", queueError);
        }
      }
    }
  };

  return (
    <div
      ref={readerRef}
      className={`reader reader-theme-${readerTheme}${isFullscreen ? " is-fullscreen" : ""}${isFullscreen && !controlsVisible ? " controls-hidden" : ""}`}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      <header className="reader-header">
        <button className="reader-brand" onClick={closeReader} aria-label="Back to CLIO home">
          <b className="brand-word">CLIO</b>
        </button>
        <div className="reader-header-leading">
          <button
            className="reader-control reader-back-btn"
            onClick={closeReader}
            title="Back to library"
            aria-label="Back to library"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            className={`reader-control reader-contents-control ${toc ? "active" : ""}`}
            onClick={() => setToc(!toc)}
            title={toc ? "Hide table of contents" : "Show table of contents"}
            aria-label={toc ? "Hide table of contents" : "Show table of contents"}
            aria-expanded={toc}
            aria-controls="reader-toc"
          >
            <List size={17} />
            <span>{toc ? "Hide contents" : "Contents"}</span>
          </button>
        </div>
        <div className="reader-book-title" title={activeDoc.title}>
          <b>{activeDoc.title}</b>
          <small>{activeDoc.author || "Unknown author"}</small>
        </div>
        <div className="reader-toolbar">
          <button
            className={`reader-control ${bookmarked ? "active" : ""}`}
            onClick={toggleCurrentBookmark}
            title={bookmarked ? "Remove page bookmark" : "Bookmark this page"}
            aria-label={
              bookmarked
                ? `Remove bookmark from page ${currentPageNumber}`
                : `Bookmark page ${currentPageNumber}`
            }
            aria-pressed={bookmarked}
          >
            <Bookmark size={17} fill={bookmarked ? "currentColor" : "none"} />
          </button>
          <button
            className={`reader-control ${notesOpen ? "active" : ""}`}
            onClick={() => setNotesOpen(!notesOpen)}
            title={notesOpen ? "Hide notes" : "Show notes"}
            aria-label={notesOpen ? "Hide notes" : "Show notes"}
            aria-expanded={notesOpen}
            aria-controls="reader-notes"
          >
            <MessageSquareText size={17} />
          </button>
          <button
            className={`reader-control ${showSettingsMenu ? "active" : ""}`}
            title="Reading settings"
            aria-label="Reading settings"
            aria-expanded={showSettingsMenu}
            aria-controls="reader-settings-menu"
            onClick={() => {
              setShowSettingsMenu(!showSettingsMenu);
              setShowMoreMenu(false);
            }}
          >
            <Settings size={17} />
          </button>
          <button
            className={`reader-control ${showMoreMenu ? "active" : ""}`}
            title="More options"
            aria-label="More options"
            aria-expanded={showMoreMenu}
            aria-controls="reader-more-menu"
            onClick={() => {
              setShowMoreMenu(!showMoreMenu);
              setShowSettingsMenu(false);
            }}
          >
            <MoreHorizontal size={17} />
          </button>

          {/* Reading Settings Dropdown */}
          {showSettingsMenu && (
            <div
              id="reader-settings-menu"
              className="reader-dropdown-menu"
              role="dialog"
              aria-label="Reading settings"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 36,
                width: 250,
                background: "rgba(255, 255, 255, 0.98)",
                backdropFilter: "blur(20px)",
                border: "1px solid #e0deda",
                borderRadius: 12,
                boxShadow: "0 12px 36px rgba(0,0,0,0.12)",
                padding: "16px",
                zIndex: 100,
                color: "#111",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                  borderBottom: "1px solid #eee",
                  paddingBottom: 8,
                }}
              >
                <b style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Reading Display
                </b>
                <button
                  onClick={() => setShowSettingsMenu(false)}
                  aria-label="Close reading settings"
                  style={{
                    background: "none",
                    border: 0,
                    padding: 2,
                    cursor: "pointer",
                    color: "#888",
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              {/* Font Choice */}
              <div style={{ marginBottom: 12 }}>
                <small style={{ fontSize: 10, color: "#777", display: "block", marginBottom: 5 }}>
                  TYPEFACE
                </small>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {["Georgia", "Inter", "Merriweather", "Courier New"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setReaderFont(f)}
                      aria-pressed={readerFont === f}
                      style={{
                        padding: "6px 8px",
                        fontSize: 11,
                        fontFamily: f,
                        border: readerFont === f ? "1.5px solid #111" : "1px solid #ddd",
                        background: readerFont === f ? "#111" : "#fafafa",
                        color: readerFont === f ? "#fff" : "#222",
                        borderRadius: 6,
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      {f === "Courier New" ? "Mono" : f}
                    </button>
                  ))}
                </div>
              </div>
              {/* Font Size */}
              <div style={{ marginBottom: 12 }}>
                <small style={{ fontSize: 10, color: "#777", display: "block", marginBottom: 5 }}>
                  TEXT SIZE ({readerFontSize}px)
                </small>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => setReaderFontSize((prev) => Math.max(12, prev - 1))}
                    style={{
                      flex: 1,
                      padding: "6px",
                      border: "1px solid #ddd",
                      borderRadius: 6,
                      background: "#fafafa",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <Minus size={13} />
                  </button>
                  <button
                    onClick={() => setReaderFontSize(16)}
                    style={{
                      flex: 1,
                      padding: "6px",
                      fontSize: 11,
                      border: "1px solid #ddd",
                      borderRadius: 6,
                      background: "#fafafa",
                      cursor: "pointer",
                    }}
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setReaderFontSize((prev) => Math.min(26, prev + 1))}
                    style={{
                      flex: 1,
                      padding: "6px",
                      border: "1px solid #ddd",
                      borderRadius: 6,
                      background: "#fafafa",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
              {/* Line Height */}
              <div style={{ marginBottom: 12 }}>
                <small style={{ fontSize: 10, color: "#777", display: "block", marginBottom: 5 }}>
                  LINE SPACING
                </small>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1.5, 1.85, 2.2].map((lh, i) => (
                    <button
                      key={lh}
                      onClick={() => setReaderLineHeight(lh)}
                      aria-pressed={readerLineHeight === lh}
                      style={{
                        flex: 1,
                        padding: "5px",
                        fontSize: 10,
                        border: readerLineHeight === lh ? "1.5px solid #111" : "1px solid #ddd",
                        background: readerLineHeight === lh ? "#111" : "#fafafa",
                        color: readerLineHeight === lh ? "#fff" : "#222",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      {["Compact", "Normal", "Spacious"][i]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <small style={{ fontSize: 10, color: "#777", display: "block", marginBottom: 5 }}>
                  PAGE COLOR
                </small>
                <div style={{ display: "flex", gap: 6 }}>
                  {(
                    [
                      ["paper", "White"],
                      ["sepia", "Sepia"],
                      ["dark", "Dark"],
                      ["contrast", "Contrast"],
                    ] as const
                  ).map(([theme, label]) => (
                    <button
                      key={theme}
                      onClick={() => {
                        setReaderTheme(theme);
                        triggerHaptic();
                      }}
                      aria-pressed={readerTheme === theme}
                      style={{
                        flex: 1,
                        padding: "6px 4px",
                        fontSize: 10,
                        border: readerTheme === theme ? "1.5px solid #111" : "1px solid #ddd",
                        background:
                          readerTheme === theme
                            ? theme === "dark"
                              ? "#1e1e24"
                              : "#111"
                            : "#fafafa",
                        color: readerTheme === theme ? "#fff" : "#222",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {isPdf && (
                <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 10 }}>
                  <small style={{ fontSize: 10, color: "#777", display: "block", marginBottom: 5 }}>
                    READING VIEW
                  </small>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => {
                        setPdfViewMode("canvas");
                        triggerHaptic();
                      }}
                      aria-pressed={pdfViewMode === "canvas"}
                      style={{
                        flex: 1,
                        padding: "6px 4px",
                        fontSize: 10,
                        border: pdfViewMode === "canvas" ? "1.5px solid #111" : "1px solid #ddd",
                        background: pdfViewMode === "canvas" ? "#111" : "#fafafa",
                        color: pdfViewMode === "canvas" ? "#fff" : "#222",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      Original PDF
                    </button>
                    <button
                      onClick={() => {
                        setPdfViewMode("text");
                        triggerHaptic();
                      }}
                      aria-pressed={pdfViewMode === "text"}
                      style={{
                        flex: 1,
                        padding: "6px 4px",
                        fontSize: 10,
                        border: pdfViewMode === "text" ? "1.5px solid #111" : "1px solid #ddd",
                        background: pdfViewMode === "text" ? "#111" : "#fafafa",
                        color: pdfViewMode === "text" ? "#fff" : "#222",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      Reflow Text
                    </button>
                  </div>
                  {pdfViewMode === "canvas" && (
                    <div className="reader-pdf-zoom">
                      <button
                        onClick={() =>
                          setPdfZoom((zoom) => Math.max(0.7, Math.round((zoom - 0.1) * 10) / 10))
                        }
                        aria-label="Zoom out"
                      >
                        <Minus size={13} />
                      </button>
                      <span>{Math.round(pdfZoom * 100)}%</span>
                      <button
                        onClick={() =>
                          setPdfZoom((zoom) => Math.min(1.8, Math.round((zoom + 0.1) * 10) / 10))
                        }
                        aria-label="Zoom in"
                      >
                        <Plus size={13} />
                      </button>
                      <button onClick={() => setPdfZoom(1)} title="Reset zoom">
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* More Options Dropdown */}
          {showMoreMenu && (
            <div
              id="reader-more-menu"
              className="reader-dropdown-menu"
              role="menu"
              aria-label="More reader options"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 220,
                background: "rgba(255, 255, 255, 0.98)",
                backdropFilter: "blur(20px)",
                border: "1px solid #e0deda",
                borderRadius: 12,
                boxShadow: "0 12px 36px rgba(0,0,0,0.12)",
                padding: "8px",
                zIndex: 100,
                color: "#111",
              }}
            >
              <button
                role="menuitem"
                onClick={() => {
                  triggerHaptic();
                  isFullscreen ? exitFullscreen() : enterFullscreen();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  border: 0,
                  background: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  textAlign: "left",
                  color: "#222",
                }}
              >
                <Maximize2 size={15} />
                <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen Reader"}</span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setShowMoreMenu(false);
                  triggerHaptic();
                  if (isTtsActive && isTtsPlaying) {
                    stopTts();
                  } else {
                    startTtsForCurrentPage();
                  }
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  border: 0,
                  background: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  textAlign: "left",
                  color: "#222",
                }}
              >
                <Volume2 size={15} />
                <span>
                  {isTtsActive && isTtsPlaying ? "Stop Narration" : "Listen to Book (TTS)"}
                </span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setShowMoreMenu(false);
                  setShowSearchModal(true);
                  triggerHaptic();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  border: 0,
                  background: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  textAlign: "left",
                  color: "#222",
                }}
              >
                <Search size={15} />
                <span>Find in Document</span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setShowMoreMenu(false);
                  setShowJumpModal(true);
                  triggerHaptic();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  border: 0,
                  background: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  textAlign: "left",
                  color: "#222",
                }}
              >
                <Compass size={15} />
                <span>Jump to Page…</span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setShowMoreMenu(false);
                  void askReaderAi("summarize");
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  border: 0,
                  background: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  textAlign: "left",
                  color: "#222",
                }}
              >
                <Sparkles size={15} />
                <span>Summarize this document</span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setShowMoreMenu(false);
                  void askReaderAi("flashcards");
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  border: 0,
                  background: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  textAlign: "left",
                  color: "#222",
                }}
              >
                <BrainCircuit size={15} />
                <span>Generate study flashcards</span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setShowMoreMenu(false);
                  void askReaderAi("quiz");
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  border: 0,
                  background: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  textAlign: "left",
                  color: "#222",
                }}
              >
                <Check size={15} />
                <span>Create a quick quiz</span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setShowMoreMenu(false);
                  void askReaderAi("extract");
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  border: 0,
                  background: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  textAlign: "left",
                  color: "#222",
                }}
              >
                <Network size={15} />
                <span>Extract people, ideas & quotes</span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setShowMoreMenu(false);
                  const markdown = [
                    `# Notes: ${activeDoc.title}`,
                    "",
                    ...notes.flatMap((note) => [
                      `## Page ${note.page}`,
                      "",
                      note.isHighlight ? `> ${note.text}` : note.text,
                      "",
                    ]),
                  ].join("\n");
                  downloadTextFile(
                    `${activeDoc.title.replace(/[^\w-]+/g, "-")}-notes.md`,
                    markdown,
                    "text/markdown;charset=utf-8",
                  );
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  border: 0,
                  background: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  textAlign: "left",
                  color: "#222",
                }}
              >
                <Download size={15} />
                <span>Export notes & highlights</span>
              </button>
              <button
                role="menuitem"
                onClick={async () => {
                  triggerHaptic();
                  const shareData = {
                    title: activeDoc.title,
                    text: activeDoc.author || "Reading in CLIO",
                    url: window.location.href,
                  };
                  try {
                    if (navigator.share) await navigator.share(shareData);
                    else if (navigator.clipboard)
                      await navigator.clipboard.writeText(
                        `${shareData.title} — ${shareData.text}\n${shareData.url}`,
                      );
                    else throw new Error("Sharing is not supported in this browser.");
                  } catch (error) {
                    if (error instanceof DOMException && error.name === "AbortError") return;
                    console.error("Unable to share this reference", error);
                  } finally {
                    setShowMoreMenu(false);
                  }
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  border: 0,
                  background: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  textAlign: "left",
                  color: "#222",
                }}
              >
                <Share2 size={15} />
                <span>Share Reference</span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  triggerHaptic();
                  window.print();
                  setShowMoreMenu(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  border: 0,
                  background: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  textAlign: "left",
                  color: "#222",
                }}
              >
                <Download size={15} />
                <span>Print / Save as PDF</span>
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="reader-body" onClick={handleReaderTap}>
        {toc && (
          <aside className="toc" id="reader-toc">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <span className="eyebrow" style={{ margin: 0 }}>
                CONTENTS
              </span>
              <button className="icon-btn" onClick={() => setToc(false)} title="Close TOC">
                <X size={15} />
              </button>
            </div>

            <div
              className="toc-section"
              style={{ marginBottom: 16, borderBottom: "1px solid #deddd9", paddingBottom: 12 }}
            >
              <button
                onClick={() => setOverviewCollapsed(!overviewCollapsed)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "none",
                  border: 0,
                  padding: "6px 0",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "11px",
                  color: "#333",
                  textAlign: "left",
                }}
              >
                <span>Document Overview</span>
                <ChevronDown
                  size={14}
                  style={{
                    transform: overviewCollapsed ? "rotate(-180deg)" : "none",
                    transition: "transform 0.2s",
                  }}
                />
              </button>
              {!overviewCollapsed && (
                <div style={{ marginTop: 10 }}>
                  <h3 style={{ fontSize: "13px", marginBottom: 10, lineHeight: 1.3 }}>
                    {activeDoc.title}
                  </h3>
                  <div
                    className="book-meta"
                    style={{ marginTop: 0, paddingTop: 10, borderTop: "1px dashed #ddd" }}
                  >
                    <ReaderCoverPreview item={activeDoc} token={token} />
                    <p style={{ fontSize: "9px", color: "#777", lineHeight: 1.4 }}>
                      <b>Author:</b> {activeDoc.author || "Unknown"}
                      <br />
                      <b>Type:</b> {activeDoc.type} · {activeDoc.fileSize || "Digital Resource"}
                      <br />
                      {activeDoc.created_at ? `Added ${formatDate(activeDoc.created_at)}` : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {bookmarkedPages.length > 0 && (
              <>
                <span className="eyebrow" style={{ marginBottom: 8, display: "block" }}>
                  BOOKMARKS
                </span>
                {bookmarkedPages.map((page) => (
                  <button
                    className={page === currentPageNumber ? "active" : ""}
                    key={`bookmark-${page}`}
                    onClick={() => (isPdf ? goToPdfPage(page) : setCurrentChapterIndex(page - 1))}
                  >
                    <Bookmark size={12} fill="currentColor" />
                    Page {page}
                  </button>
                ))}
                <div style={{ margin: "16px 0", borderBottom: "1px solid #deddd9" }} />
              </>
            )}

            <span className="eyebrow" style={{ marginBottom: 8, display: "block" }}>
              {isPdf ? "PAGES" : "CHAPTERS"}
            </span>
            {isPdf
              ? Array.from({ length: pdfPageCount || activeDoc.pdfPageCount || 0 }, (_, i) => (
                  <button
                    className={i === safeChapterIndex ? "active" : ""}
                    key={i + 1}
                    onClick={() => goToPdfPage(i + 1)}
                  >
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <PdfPageThumbnail item={activeDoc} token={token} pageNumber={i + 1} />
                    Page {i + 1}
                  </button>
                ))
              : chapters.map((ch: Chapter, i: number) => (
                  <button
                    className={i === safeChapterIndex ? "active" : ""}
                    key={ch.id || i}
                    onClick={() => {
                      setCurrentChapterIndex(i);
                      setHighlight(false);
                    }}
                  >
                    <span>{String(ch.id || i + 1).padStart(2, "0")}</span>
                    {ch.title}
                  </button>
                ))}
          </aside>
        )}
        {isPdf && pdfViewMode === "canvas" ? (
          <div
            className="pdf-reader-scroll"
            ref={pdfPageRef}
            tabIndex={0}
            aria-label="PDF pages. Swipe horizontally or use the left and right arrow keys to change pages."
            onTouchStart={handlePdfTouchStart}
            onTouchEnd={handlePdfTouchEnd}
          >
            <PdfDocumentView
              item={activeDoc}
              token={token}
              pageRef={pdfPageRef}
              onPageCount={updatePdfPageCount}
              pageNumber={safeChapterIndex + 1}
              zoom={pdfZoom}
              fallbackChapters={chapters}
            />
          </div>
        ) : (
          <article
            ref={bookPageRef}
            className="book-page"
            key={safeChapterIndex}
            onTouchStart={handlePdfTouchStart}
            onTouchEnd={handlePdfTouchEnd}
            style={{
              fontFamily: readerFont,
              fontSize: `${readerFontSize}px`,
              lineHeight: readerLineHeight,
            }}
          >
            <span className="chapter-no">
              {String(chapter.id || safeChapterIndex + 1).padStart(2, "0")}
            </span>
            <h1 style={{ fontFamily: readerFont }}>{chapter.title}</h1>
            {chapter.subtitle && (
              <p
                className="book-subtitle"
                style={{
                  color: "#888",
                  fontSize: `${Math.max(12, readerFontSize - 3)}px`,
                  marginBottom: 24,
                }}
              >
                {chapter.subtitle}
              </p>
            )}
            <p className="lead" style={{ fontSize: `${readerFontSize + 3}px` }}>
              {chapter.lead}
            </p>
            {chapter.paragraphs.map((para, idx) => (
              <p
                key={idx}
                className={highlight && idx === 1 ? "selected-text" : ""}
                onClick={() => idx === 1 && setHighlight(!highlight)}
                style={{ fontSize: `${readerFontSize}px` }}
              >
                {para}
              </p>
            ))}
            {highlight && (
              <div className="selection-toolbar">
                <button title="Highlight text">
                  <Highlighter size={16} />
                </button>
                <button
                  title="Add note from highlight"
                  onClick={() => {
                    setIsAddingNote(true);
                    setNewNoteText(`Highlight: "${chapter.paragraphs[1]?.slice(0, 55)}..." `);
                    setNotesOpen(true);
                  }}
                >
                  <MessageSquareText size={16} />
                </button>
                <button
                  title="Ask AI about this passage"
                  onClick={() => void askReaderAi("explain")}
                >
                  <Sparkles size={16} />
                </button>
                <i />
                <button onClick={() => setHighlight(false)}>
                  <X size={15} />
                </button>
              </div>
            )}
          </article>
        )}
        {notesOpen && (
          <aside className="reader-notes" id="reader-notes">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "12px",
              }}
            >
              <div>
                <span className="eyebrow">
                  {filterMode === "chapter"
                    ? `${isPdf ? "PAGE" : "CHAPTER"} ${isPdf ? safeChapterIndex + 1 : chapter.id}`
                    : isPdf
                      ? "ALL PAGES"
                      : "ALL CHAPTERS"}
                </span>
                <h3>Notes ({visibleNotes.length})</h3>
              </div>
              <button
                className="select-btn"
                style={{ fontSize: "9px", padding: "3px 7px", height: "auto" }}
                onClick={() => setFilterMode(filterMode === "chapter" ? "all" : "chapter")}
              >
                {filterMode === "chapter" ? "Show all" : "This chapter"}
              </button>
            </div>
            <div className="note-line" />
            {isAddingNote ? (
              <div className="note-editor">
                <textarea
                  autoFocus
                  placeholder="Write your note or reflection for this chapter..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveNote();
                  }}
                />
                <div className="note-editor-actions">
                  <button
                    className="note-cancel-btn"
                    onClick={() => {
                      setIsAddingNote(false);
                      setNewNoteText("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="note-save-btn"
                    onClick={handleSaveNote}
                    disabled={!newNoteText.trim() || savingNote}
                  >
                    {savingNote ? <Loader2 size={12} className="spin" /> : "Save note"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="add-note"
                onClick={() => setIsAddingNote(true)}
                style={{ marginTop: "12px", cursor: "pointer" }}
              >
                <Plus size={15} /> Add a note
              </button>
            )}
            {visibleNotes.length === 0 ? (
              <p className="reader-notes-empty">
                No notes yet in this{" "}
                {filterMode === "chapter" ? (isPdf ? "page" : "chapter") : "document"}.
              </p>
            ) : (
              visibleNotes.map((note) => (
                <div className="note-item" key={note.id}>
                  <p>{note.text}</p>
                  <div className="note-meta">
                    <span>
                      {note.isHighlight ? "Highlight" : "Note"} · Page {note.page} ·{" "}
                      {note.createdAt}
                    </span>
                    <button
                      className="note-delete-btn"
                      title="Delete note"
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </aside>
        )}
      </div>

      {/* Floating Audio / TTS Bar */}
      {isTtsActive && (
        <div className="reader-tts-bar" role="region" aria-label="Audio narration controls">
          <button
            className="reader-tts-play-btn"
            onClick={toggleTtsPlayPause}
            title={isTtsPlaying ? "Pause audio narration" : "Resume audio narration"}
          >
            {isTtsPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <span>Page {currentPageNumber}</span>
          <button
            className="reader-tts-speed-badge"
            onClick={() => {
              const speeds = [1.0, 1.25, 1.5, 2.0, 0.8];
              const nextIdx = (speeds.indexOf(ttsSpeed) + 1) % speeds.length;
              setTtsSpeed(speeds[nextIdx]);
              triggerHaptic();
            }}
            title="Narration playback speed"
          >
            {ttsSpeed}x
          </button>
          <button onClick={stopTts} title="Stop listening" style={{ marginLeft: 4 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* In-Document Search Dialog */}
      {showSearchModal && (
        <div
          className="overlay"
          onMouseDown={() => setShowSearchModal(false)}
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="modal"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460, maxHeight: "80vh", display: "flex", flexDirection: "column" }}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">FIND IN DOCUMENT</span>
                <h2>Search Document</h2>
              </div>
              <button onClick={() => setShowSearchModal(false)} aria-label="Close search">
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee" }}>
              <input
                autoFocus
                placeholder={`Search in "${activeDoc.title}"…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  fontSize: 13,
                }}
              />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 16px" }}>
              {searchQuery.trim() && searchResults.length === 0 ? (
                <p style={{ textAlign: "center", color: "#888", fontSize: 12, padding: "24px 0" }}>
                  No occurrences found for "{searchQuery}"
                </p>
              ) : (
                searchResults.map((res, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      if (isPdf && pdfViewMode === "canvas") goToPdfPage(res.page);
                      else setCurrentChapterIndex(res.page - 1);
                      setShowSearchModal(false);
                      triggerHaptic();
                    }}
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid #eee",
                      cursor: "pointer",
                      borderRadius: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      Page {res.page}
                    </span>
                    <p style={{ fontSize: 12, margin: "4px 0 0", color: "#222", lineHeight: 1.5 }}>
                      {res.snippet}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Jump to Page Scrubber Dialog */}
      {showJumpModal && (
        <div
          className="overlay"
          onMouseDown={() => setShowJumpModal(false)}
          onClick={() => setShowJumpModal(false)}
        >
          <div
            className="modal"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 360 }}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">NAVIGATION</span>
                <h2>Jump to Page</h2>
              </div>
              <button onClick={() => setShowJumpModal(false)} aria-label="Close dialog">
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>Target Page:</span>
                <select
                  value={jumpTargetPage}
                  onChange={(e) => setJumpTargetPage(Number(e.target.value))}
                  aria-label="Select target page"
                  style={{
                    minWidth: 120,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {Array.from({ length: totalSections }, (_, index) => index + 1).map((page) => (
                    <option value={page} key={page}>
                      Page {page}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn"
                style={{
                  width: "100%",
                  background: "#111",
                  color: "#fff",
                  padding: "10px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (isPdf && pdfViewMode === "canvas") goToPdfPage(jumpTargetPage);
                  else setCurrentChapterIndex(jumpTargetPage - 1);
                  setShowJumpModal(false);
                  triggerHaptic();
                }}
              >
                Go to Page {jumpTargetPage}
              </button>
            </div>
          </div>
        </div>
      )}

      {(readerAiLoading || readerAiResult) && (
        <div
          className="overlay reader-ai-overlay"
          onMouseDown={() => {
            if (!readerAiLoading) setReaderAiResult(null);
          }}
        >
          <section
            className="modal reader-ai-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reader-ai-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">CLIO INTELLIGENCE · {activeDoc.title}</span>
                <h2 id="reader-ai-title">
                  {readerAiLoading ? "Thinking…" : readerAiResult?.title}
                </h2>
              </div>
              <button
                onClick={() => setReaderAiResult(null)}
                disabled={readerAiLoading}
                aria-label="Close AI result"
              >
                <X size={18} />
              </button>
            </div>
            <div className="reader-ai-result">
              {readerAiLoading ? (
                <p>
                  <Loader2 size={17} className="spin" /> Preparing a grounded response from your
                  document…
                </p>
              ) : (
                <pre>{readerAiResult?.content}</pre>
              )}
              {readerAiError && (
                <p className="reader-ai-error" role="alert">
                  {readerAiError}
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="secondary"
                onClick={() => void askReaderAi("explain")}
                disabled={readerAiLoading}
              >
                <Sparkles size={14} /> Explain passage
              </button>
              <button
                className="primary"
                onClick={() => setReaderAiResult(null)}
                disabled={readerAiLoading}
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// ─── Converter Page ───────────────────────────────────────────────────────────
type ConversionFormat = "PDF" | "DOCX" | "EPUB" | "TXT" | "HTML" | "MD";

function htmlToPlainText(html: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  document.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, tr").forEach((element) => {
    element.append("\n");
  });
  return (document.body.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function normalizeArchivePath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return segments.join("/");
}

function readXml(source: string, label: string): Document {
  const parsed = new DOMParser().parseFromString(source, "application/xml");
  if (parsed.querySelector("parsererror"))
    throw new Error(`The ${label} file is invalid or damaged.`);
  return parsed;
}

async function extractDocumentText(file: File, format: ConversionFormat): Promise<string> {
  const buffer = await file.arrayBuffer();
  if (format === "TXT" || format === "MD") return new TextDecoder().decode(buffer);
  if (format === "HTML") return htmlToPlainText(new TextDecoder().decode(buffer));

  if (format === "DOCX" || format === "EPUB") {
    const archive = unzipSync(new Uint8Array(buffer));
    if (format === "DOCX") {
      const documentXml = archive["word/document.xml"];
      if (!documentXml) throw new Error("This DOCX file is missing its document content.");
      const xml = readXml(strFromU8(documentXml), "DOCX");
      return Array.from(xml.getElementsByTagNameNS("*", "p"))
        .map((paragraph) =>
          Array.from(paragraph.getElementsByTagNameNS("*", "t"))
            .map((text) => text.textContent || "")
            .join(""),
        )
        .join("\n");
    }

    const container = archive["META-INF/container.xml"];
    if (!container) throw new Error("This EPUB file is missing its package manifest.");
    const containerXml = readXml(strFromU8(container), "EPUB");
    const packagePath = containerXml
      .getElementsByTagNameNS("*", "rootfile")[0]
      ?.getAttribute("full-path");
    if (!packagePath) throw new Error("This EPUB file has no readable package manifest.");
    const packageBytes = archive[normalizeArchivePath(packagePath)];
    if (!packageBytes) throw new Error("This EPUB package manifest is missing.");

    const packageXml = readXml(strFromU8(packageBytes), "EPUB");
    const manifest = new Map<string, string>();
    for (const item of Array.from(packageXml.getElementsByTagNameNS("*", "item"))) {
      const id = item.getAttribute("id");
      const href = item.getAttribute("href");
      if (id && href && !/nav|cover/i.test(`${id} ${href}`)) manifest.set(id, href);
    }
    const packageDirectory = packagePath.slice(0, packagePath.lastIndexOf("/") + 1);
    const chapterTexts: string[] = [];
    for (const itemRef of Array.from(packageXml.getElementsByTagNameNS("*", "itemref"))) {
      const href = manifest.get(itemRef.getAttribute("idref") || "");
      if (!href) continue;
      const entryPath = normalizeArchivePath(
        `${packageDirectory}${decodeURIComponent(href.split("#")[0].split("?")[0])}`,
      );
      const chapter = archive[entryPath];
      if (chapter) chapterTexts.push(htmlToPlainText(strFromU8(chapter)));
    }
    if (!chapterTexts.length) throw new Error("This EPUB file contains no readable chapters.");
    return chapterTexts.join("\n\n");
  }

  if (format === "PDF") {
    const pdfjsLib = await loadPdfJs();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    try {
      const document = await loadingTask.promise;
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map((item: any) => item.str || "").join(" "));
      }
      const text = pages.join("\n\n").trim();
      if (!text)
        throw new Error(
          "This PDF has no selectable text. Scanned PDFs require OCR, which is not available in the offline converter.",
        );
      return text;
    } finally {
      await loadingTask.destroy();
    }
  }

  throw new Error(`Reading ${format} files is not supported.`);
}

async function extractPresentationText(file: File, format: "PPTX" | "XLSX"): Promise<string> {
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  if (format === "PPTX") {
    const slides = Object.keys(archive)
      .map((path) => ({ path, match: path.match(/^ppt\/slides\/slide(\d+)\.xml$/) }))
      .filter((entry): entry is { path: string; match: RegExpMatchArray } => entry.match !== null)
      .sort((left, right) => Number(left.match[1]) - Number(right.match[1]));
    if (!slides.length) throw new Error("This presentation contains no readable slides.");
    return slides
      .map(({ path, match }) => {
        const xml = readXml(strFromU8(archive[path]), "PPTX slide");
        const text = Array.from(xml.getElementsByTagNameNS("*", "t"))
          .map((node) => node.textContent || "")
          .join(" ");
        return `Slide ${match[1]}\n${text}`;
      })
      .join("\n\n");
  }

  const workbookBytes = archive["xl/workbook.xml"];
  const relationshipBytes = archive["xl/_rels/workbook.xml.rels"];
  if (!workbookBytes || !relationshipBytes)
    throw new Error("This spreadsheet is missing its workbook data.");
  const workbook = readXml(strFromU8(workbookBytes), "XLSX workbook");
  const relationships = readXml(strFromU8(relationshipBytes), "XLSX relationships");
  const targets = new Map(
    Array.from(relationships.getElementsByTagNameNS("*", "Relationship")).map((relationship) => [
      relationship.getAttribute("Id") || "",
      relationship.getAttribute("Target") || "",
    ]),
  );
  const sharedStrings = archive["xl/sharedStrings.xml"]
    ? Array.from(
        readXml(
          strFromU8(archive["xl/sharedStrings.xml"]),
          "XLSX shared strings",
        ).getElementsByTagNameNS("*", "si"),
      ).map((item) =>
        Array.from(item.getElementsByTagNameNS("*", "t"))
          .map((text) => text.textContent || "")
          .join(""),
      )
    : [];
  const sheets: string[] = [];
  for (const sheet of Array.from(workbook.getElementsByTagNameNS("*", "sheet"))) {
    const name = sheet.getAttribute("name") || "Sheet";
    const relationshipId =
      sheet.getAttributeNS(
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "id",
      ) || sheet.getAttribute("r:id");
    const target = targets.get(relationshipId || "");
    if (!target) continue;
    const sheetPath = target.startsWith("/")
      ? normalizeArchivePath(target.slice(1))
      : normalizeArchivePath(`xl/${target}`);
    const sheetBytes = archive[sheetPath];
    if (!sheetBytes) continue;
    const sheetXml = readXml(strFromU8(sheetBytes), "XLSX sheet");
    const rows = Array.from(sheetXml.getElementsByTagNameNS("*", "row"))
      .map((row) =>
        Array.from(row.getElementsByTagNameNS("*", "c"))
          .map((cell) => {
            const value = cell.getElementsByTagNameNS("*", "v")[0]?.textContent || "";
            if (cell.getAttribute("t") === "s") return sharedStrings[Number(value)] || "";
            if (cell.getAttribute("t") === "inlineStr") {
              return Array.from(cell.getElementsByTagNameNS("*", "t"))
                .map((text) => text.textContent || "")
                .join("");
            }
            return value;
          })
          .filter(Boolean)
          .join(" | "),
      )
      .filter(Boolean);
    if (rows.length) sheets.push(`Sheet: ${name}\n${rows.join("\n")}`);
  }
  if (!sheets.length) throw new Error("This spreadsheet contains no readable cell data.");
  return sheets.join("\n\n");
}

function buildDownloadedTextChapters(text: string, title: string): Chapter[] {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const pages: Chapter[] = [];
  for (let index = 0; index < paragraphs.length; index += 3) {
    const chunk = paragraphs.slice(index, index + 3);
    pages.push({
      id: pages.length + 1,
      title: `Page ${pages.length + 1}`,
      subtitle: `${title} · Page ${pages.length + 1}`,
      pageStart: pages.length + 1,
      lead: chunk[0] || "",
      paragraphs: chunk.slice(1),
    });
  }
  return pages;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function convertDocumentText(
  text: string,
  format: ConversionFormat,
  title: string,
): Promise<Blob> {
  if (format === "TXT" || format === "MD")
    return new Blob([text], { type: format === "MD" ? "text/markdown" : "text/plain" });
  if (format === "HTML") {
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return new Blob(
      [
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.replace(/[&<>"]/g, "")}</title></head><body><pre style="white-space:pre-wrap;font:16px/1.6 sans-serif">${escaped}</pre></body></html>`,
      ],
      { type: "text/html" },
    );
  }
  if (format === "DOCX") {
    const { Document: WordDocument, Packer, Paragraph, TextRun } = await import("docx");
    const document = new WordDocument({
      sections: [
        {
          properties: {},
          children: text
            .split(/\r?\n/)
            .map((line) => new Paragraph({ children: [new TextRun(line || " ")] })),
        },
      ],
    });
    return Packer.toBlob(document);
  }
  if (format === "EPUB") {
    const safeTitle = title.replace(/[&<>"]/g, "");
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const paragraphs = escaped
      .split(/\r?\n/)
      .map((line) => `<p>${line || "&#160;"}</p>`)
      .join("\n");
    const archive = zipSync(
      {
        mimetype: strToU8("application/epub+zip"),
        "META-INF/container.xml": strToU8(
          '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
        ),
        "EPUB/package.opf": strToU8(
          `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${crypto.randomUUID()}</dc:identifier><dc:title>${safeTitle}</dc:title><dc:language>en</dc:language></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="chapter"/></spine></package>`,
        ),
        "EPUB/chapter.xhtml": strToU8(
          `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${safeTitle}</title></head><body><h1>${safeTitle}</h1>${paragraphs}</body></html>`,
        ),
        "EPUB/nav.xhtml": strToU8(
          `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol><li><a href="chapter.xhtml">${safeTitle}</a></li></ol></nav></body></html>`,
        ),
      },
      { level: 0 },
    );
    return new Blob([new Uint8Array(archive)], { type: "application/epub+zip" });
  }
  if (format === "PDF") {
    const { PDFDocument: EditablePdfDocument, StandardFonts } = await import("pdf-lib");
    const pdf = await EditablePdfDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pageSize: [number, number] = [595.28, 841.89];
    const fontSize = 11;
    const lineHeight = 16;
    const maxWidth = pageSize[0] - 96;
    const safeText = text.replace(/[^\u0009\u000a\u000d\u0020-\u00ff]/g, "?");
    const lines: string[] = [];
    for (const paragraph of safeText.split(/\r?\n/)) {
      if (!paragraph) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
    }

    let page = pdf.addPage(pageSize);
    let y = pageSize[1] - 52;
    page.drawText(title.replace(/[^\u0020-\u00ff]/g, "?"), { x: 48, y, size: 18, font });
    y -= 30;
    for (const line of lines) {
      if (y < 48) {
        page = pdf.addPage(pageSize);
        y = pageSize[1] - 48;
      }
      page.drawText(line, { x: 48, y, size: fontSize, font });
      y -= lineHeight;
    }
    return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
  }
  throw new Error(`Creating ${format} files is not supported.`);
}

function ConverterPage({
  onShowDownloads,
  onConversionComplete,
}: {
  onShowDownloads: () => void;
  onConversionComplete: (file: File, text: string, title: string) => Promise<void>;
}) {
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [fileType, setFileType] = useState<ConversionFormat | "">("");
  const [targetFormat, setTargetFormat] = useState<ConversionFormat>("TXT");
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedFile, setConvertedFile] = useState<{ blob: Blob; name: string } | null>(null);
  const [error, setError] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");
  const [isSavingDownload, setIsSavingDownload] = useState(false);
  const [conversionHistory, setConversionHistory] = useState<
    { name: string; from: string; to: string; date: Date; blob: Blob; downloadName: string }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);
  const formats: ConversionFormat[] = ["DOCX", "PDF", "EPUB", "TXT", "HTML", "MD"];

  const handleDownload = async (blob: Blob, name: string) => {
    setIsSavingDownload(true);
    setDownloadMessage("");
    setError("");
    try {
      const saved = await saveDownloadedFile(blob, name);
      if (!Capacitor.isNativePlatform()) downloadBlob(blob, name);
      setDownloadMessage(`Saved to ${saved.path}`);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to save the converted file.",
      );
    } finally {
      setIsSavingDownload(false);
    }
  };

  const handleSelect = (files: FileList | null) => {
    const selectedFile = files?.[0];
    if (!selectedFile) return;
    const extension = selectedFile.name.split(".").pop()?.toUpperCase() || "";
    const normalizedExtension =
      extension === "MARKDOWN" ? "MD" : extension === "HTM" ? "HTML" : extension;
    if (!formats.includes(normalizedExtension as ConversionFormat)) {
      setError("Choose a PDF, DOCX, EPUB, TXT, Markdown, or HTML file.");
      return;
    }
    const format = normalizedExtension as ConversionFormat;
    selectedFileRef.current = selectedFile;
    setFileName(selectedFile.name);
    setFileType(format);
    setFileSize(formatBytes(selectedFile.size));
    setTargetFormat(formats.find((candidate) => candidate !== format) || "TXT");
    setConvertedFile(null);
    setError("");
  };

  const clearFile = () => {
    selectedFileRef.current = null;
    setFileName("");
    setFileSize("");
    setFileType("");
    setConvertedFile(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConvert = async () => {
    const file = selectedFileRef.current;
    if (!file || !fileType) return;
    setIsConverting(true);
    setError("");
    setConvertedFile(null);
    try {
      const text = await extractDocumentText(file, fileType);
      if (!text.trim()) throw new Error("This file contains no readable text to convert.");
      const title = fileName.replace(/\.[^/.]+$/, "");
      const output = await convertDocumentText(text, targetFormat, title);
      const downloadName = `${fileName.replace(/\.[^/.]+$/, "")}.${targetFormat.toLowerCase()}`;
      setConvertedFile({ blob: output, name: downloadName });
      setDownloadMessage("");
      setConversionHistory((previous) => [
        {
          name: fileName,
          from: fileType,
          to: targetFormat,
          date: new Date(),
          blob: output,
          downloadName,
        },
        ...previous.slice(0, 9),
      ]);
      const converted = new globalThis.File([output], downloadName, {
        type: output.type || "application/octet-stream",
      });
      await saveDownloadedFile(output, downloadName);
      await onConversionComplete(converted, text, title);
      setDownloadMessage("Saved to your library and opened in the reader.");
    } catch (conversionError) {
      setError(
        conversionError instanceof Error
          ? conversionError.message
          : "The file could not be converted.",
      );
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <main className="page narrow-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TOOLS</span>
          <h1>File Converter</h1>
          <p>
            Convert document text locally on your device. Images and original page layout are not
            retained.
          </p>
        </div>
      </div>
      <div className="converter">
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf,.docx,.epub,.txt,.md,.markdown,.html,.htm"
          style={{ display: "none" }}
          onChange={(event) => handleSelect(event.target.files)}
        />
        {!fileType ? (
          <button
            className={`drop-zone ${isDragging ? "drag-active" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              handleSelect(event.dataTransfer.files);
            }}
          >
            <span>
              <Upload size={22} />
            </span>
            <h3>Choose a document to convert</h3>
            <p>Tap to browse or drop a file here</p>
            <small>PDF, DOCX, EPUB, TXT, Markdown, and HTML</small>
          </button>
        ) : (
          <div className="convert-file">
            <div className="file-preview">
              <span>
                <FileText size={22} />
              </span>
              <div>
                <b>{fileName}</b>
                <small>
                  {fileType} document · {fileSize}
                </small>
              </div>
              <button type="button" onClick={clearFile} aria-label="Remove selected file">
                <X size={16} />
              </button>
            </div>
            <div className="conversion-arrow">
              <ArrowRight size={18} />
            </div>
            <label className="format-box">
              <small>CONVERT TO</small>
              <select
                value={targetFormat}
                onChange={(event) => {
                  setTargetFormat(event.target.value as ConversionFormat);
                  setConvertedFile(null);
                }}
              >
                {formats
                  .filter((format) => format !== fileType)
                  .map((format) => (
                    <option value={format} key={format}>
                      {format}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        )}
        {fileType && (
          <>
            {fileType === "PDF" && (
              <p className="conversion-note">
                Scanned PDFs without selectable text cannot be converted because offline OCR is not
                available.
              </p>
            )}
            <button className="primary convert-btn" onClick={handleConvert} disabled={isConverting}>
              {isConverting ? (
                <>
                  <Loader2 size={17} className="spin" /> Converting file…
                </>
              ) : (
                <>
                  <ArrowLeftRight size={17} /> Convert to {targetFormat}
                </>
              )}
            </button>
          </>
        )}
        {error && (
          <p className="conversion-error" role="alert">
            {error}
          </p>
        )}
        {convertedFile && (
          <div className="success">
            <Check size={18} />
            <div>
              <b>Your converted file is ready</b>
              <small>{convertedFile.name}</small>
            </div>
            <button
              onClick={() => handleDownload(convertedFile.blob, convertedFile.name)}
              disabled={isSavingDownload}
            >
              {isSavingDownload ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
              {isSavingDownload ? "Saving…" : `Save ${targetFormat}`}
            </button>
          </div>
        )}
        {downloadMessage && (
          <div className="download-saved-message" role="status">
            <span>{downloadMessage}</span>
            <button type="button" onClick={onShowDownloads}>
              View downloaded files
            </button>
          </div>
        )}
      </div>
      {conversionHistory.length > 0 && (
        <section className="section history">
          <div className="section-title">
            <h2>Recent conversions</h2>
          </div>
          {conversionHistory.map((conversion, index) => (
            <div className="history-row" key={`${conversion.date.getTime()}-${index}`}>
              <span>
                <FileText size={16} />
              </span>
              <div>
                <b>{conversion.name}</b>
                <small>
                  {conversion.from} → {conversion.to}
                </small>
              </div>
              <small>{formatRelative(conversion.date.toISOString())}</small>
              <button
                title={`Download ${conversion.downloadName}`}
                aria-label={`Save ${conversion.downloadName} to Downloads`}
                onClick={() => handleDownload(conversion.blob, conversion.downloadName)}
                disabled={isSavingDownload}
              >
                {isSavingDownload ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
              </button>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

function DownloadedFilesPage({
  onViewFile,
}: {
  onViewFile: (file: DownloadedFile) => Promise<void>;
}) {
  const [files, setFiles] = useState<DownloadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  const refreshFiles = async () => {
    setIsLoading(true);
    setError("");
    try {
      setFiles(await getDownloadedFiles());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load downloaded files.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshFiles();
  }, []);

  const openFile = async (file: DownloadedFile) => {
    setBusyFileId(file.id);
    setError("");
    try {
      if (!isAndroid) throw new Error("Open with another app is available on Android.");
      await openDownloadedFile(file);
    } catch (openError) {
      setError(
        openError instanceof Error ? openError.message : "Unable to open this downloaded file.",
      );
    } finally {
      setBusyFileId(null);
    }
  };

  const viewFile = async (file: DownloadedFile) => {
    setBusyFileId(file.id);
    setError("");
    try {
      await onViewFile(file);
    } catch (viewError) {
      setError(
        viewError instanceof Error ? viewError.message : "Unable to view this downloaded file.",
      );
    } finally {
      setBusyFileId(null);
    }
  };

  const removeFile = async (file: DownloadedFile) => {
    setBusyFileId(file.id);
    setError("");
    try {
      await deleteDownloadedFile(file);
      setFiles((current) => current.filter((entry) => entry.id !== file.id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete this downloaded file.",
      );
    } finally {
      setBusyFileId(null);
    }
  };

  return (
    <main className="page narrow-page downloaded-files-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR DEVICE</span>
          <h1>Downloaded files</h1>
          <p>Converted files saved from CLIO, ready to open again.</p>
        </div>
        <button
          className="secondary downloaded-refresh"
          onClick={() => void refreshFiles()}
          disabled={isLoading}
        >
          <RefreshCw size={15} className={isLoading ? "spin" : ""} /> Refresh
        </button>
      </div>
      <div className="download-directory">
        <Folder size={17} />
        <div>
          <b>{isAndroid ? "Downloads/CLIO" : "CLIO Downloads"}</b>
          <small>
            {isAndroid
              ? "Also available in your device's Files app under Downloads → CLIO."
              : "Saved in this browser on this device."}
          </small>
        </div>
      </div>
      {error && (
        <p className="conversion-error" role="alert">
          {error}
        </p>
      )}
      {isLoading ? (
        <div className="download-empty">
          <Loader2 size={20} className="spin" />
          <span>Loading downloaded files…</span>
        </div>
      ) : files.length === 0 ? (
        <div className="download-empty">
          <Download size={24} />
          <b>No downloaded files yet</b>
          <span>Converted files you save will appear here with their device directory.</span>
        </div>
      ) : (
        <section className="downloaded-file-list" aria-label="Downloaded files">
          {files.map((file) => (
            <article className="downloaded-file" key={file.id}>
              <span className="downloaded-file-icon">
                <FileText size={19} />
              </span>
              <div className="downloaded-file-details">
                <b title={file.name}>{file.name}</b>
                <small>
                  {formatBytes(file.size)} · {new Date(file.modifiedAt).toLocaleString()}
                </small>
                <code title={file.path}>{file.path}</code>
              </div>
              <button
                type="button"
                className="primary downloaded-open"
                onClick={() => void viewFile(file)}
                disabled={busyFileId === file.id}
                aria-label={`View ${file.name} in CLIO`}
              >
                {busyFileId === file.id ? (
                  <Loader2 size={15} className="spin" />
                ) : (
                  <Eye size={15} />
                )}
                <span>View</span>
              </button>
              {isAndroid && (
                <button
                  type="button"
                  className="icon-btn downloaded-delete"
                  onClick={() => void openFile(file)}
                  disabled={busyFileId === file.id}
                  aria-label={`Open ${file.name} with another app`}
                  title="Open with another app"
                >
                  <ExternalLink size={16} />
                </button>
              )}
              <button
                type="button"
                className="icon-btn downloaded-delete"
                onClick={() => void removeFile(file)}
                disabled={busyFileId === file.id}
                aria-label={`Delete ${file.name}`}
                title="Delete downloaded file"
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

// ─── PDF Toolkit Page ─────────────────────────────────────────────────────────
function PdfToolkitPage({
  items,
  token,
  onOpenReader,
}: {
  items: LibraryItem[];
  token: string | null;
  onOpenReader: (item: LibraryItem) => void;
}) {
  const pdfItems = useMemo(() => items.filter((i) => i.type.toUpperCase() === "PDF"), [items]);
  const [selectedDocId, setSelectedDocId] = useState<string>(pdfItems[0]?.id || "");
  const [activeTool, setActiveTool] = useState<"metadata" | "extract" | "split" | "optimize">(
    "metadata",
  );
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfInfo, setPdfInfo] = useState<{
    pageCount: number;
    title: string;
    author: string;
    fileSize: string;
    extractedTextSample?: string;
    wordCount?: number;
  } | null>(null);
  const [splitRange, setSplitRange] = useState("1-5");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isExportingRange, setIsExportingRange] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDoc = useMemo(() => {
    if (customFile) {
      return {
        id: "custom",
        title: customFile.name.replace(/\.pdf$/i, ""),
        author: "Uploaded PDF",
        fileSize: formatBytes(customFile.size),
        type: "PDF",
      } as Partial<LibraryItem>;
    }
    return pdfItems.find((d) => d.id === selectedDocId) || pdfItems[0];
  }, [customFile, selectedDocId, pdfItems]);

  const analyzeDoc = useCallback(async (fileOrBlob: Blob, docTitle: string, docSize: string) => {
    setIsProcessing(true);
    setStatusMessage("Inspecting PDF structure…");
    try {
      const buffer = await fileOrBlob.arrayBuffer();
      const binary = parsePdfBinaryInfo(buffer);
      let finalPages = binary.pageCount;
      const extractedPages: string[] = [];
      let totalWords = 0;
      const pdfjsLib = await loadPdfJs();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
      });
      const document = await loadingTask.promise;
      try {
        finalPages = document.numPages;
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
          setStatusMessage(`Extracting page ${pageNumber} of ${document.numPages}…`);
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          const text = content.items
            .map((item: any) => item.str || "")
            .join(" ")
            .trim();
          extractedPages.push(text);
          totalWords += text.split(/\s+/).filter(Boolean).length;
        }
      } finally {
        await loadingTask.destroy();
      }

      setPdfInfo({
        pageCount: finalPages,
        title: binary.title || docTitle,
        author: binary.author || "Unknown Author",
        fileSize: docSize,
        extractedTextSample: extractedPages
          .map((text, index) => `[Page ${index + 1}]\n${text}`)
          .join("\n\n")
          .trim(),
        wordCount: totalWords,
      });
      setStatusMessage("Analysis complete.");
    } catch (error) {
      setPdfInfo(null);
      setStatusMessage(
        `Unable to inspect this PDF: ${error instanceof Error ? error.message : "Invalid document."}`,
      );
    } finally {
      setIsProcessing(false);
    }
  }, []);

  useEffect(() => {
    if (customFile) {
      setPdfInfo(null);
      analyzeDoc(customFile, customFile.name, formatBytes(customFile.size));
      return;
    }
    if (activeDoc) {
      setPdfInfo(null);
      getLocalPdf(activeDoc.id || "")
        .then((blob) => {
          if (blob) {
            analyzeDoc(blob, activeDoc.title || "PDF", activeDoc.fileSize || "PDF Document");
            return;
          }
          if (token && activeDoc.id && !activeDoc.id.startsWith("local-")) {
            return fetch(`${API}/library/${encodeURIComponent(activeDoc.id)}/file`, {
              headers: { Authorization: `Bearer ${token}` },
            }).then(async (response) => {
              if (!response.ok)
                throw new Error(`Unable to fetch the original PDF (${response.status}).`);
              await analyzeDoc(
                await response.blob(),
                activeDoc.title || "PDF",
                activeDoc.fileSize || "PDF Document",
              );
            });
          }
          setPdfInfo({
            pageCount: activeDoc.pdfPageCount || 0,
            title: activeDoc.title || "PDF",
            author: activeDoc.author || "Unknown",
            fileSize: activeDoc.fileSize || "Library Item",
          });
          setStatusMessage(
            "Original PDF is not stored on this device. Upload it here or sign in to fetch it.",
          );
        })
        .catch((error) => {
          setPdfInfo(null);
          setStatusMessage(
            `Unable to load the original PDF: ${error instanceof Error ? error.message : "Storage error."}`,
          );
        });
    } else {
      setPdfInfo(null);
      setStatusMessage(null);
    }
  }, [activeDoc, customFile, token, analyzeDoc]);

  const handleCustomUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    setCustomFile(f);
  };

  const handleDownloadExtractedText = () => {
    if (!pdfInfo?.extractedTextSample) return;
    const blob = new Blob([pdfInfo.extractedTextSample], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${(activeDoc?.title || "extracted").replace(/[^a-z0-9]/gi, "_")}_text.txt`);
  };

  const handleExportPageRange = async () => {
    setIsExportingRange(true);
    setStatusMessage(null);
    try {
      const sourceFile = customFile || (activeDoc?.id ? await getLocalPdf(activeDoc.id) : null);
      let pdfBlob = sourceFile;
      if (!pdfBlob && token && activeDoc?.id && !activeDoc.id.startsWith("local-")) {
        const response = await fetch(`${API}/library/${encodeURIComponent(activeDoc.id)}/file`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`Unable to fetch the original PDF (${response.status}).`);
        pdfBlob = await response.blob();
      }
      if (!pdfBlob)
        throw new Error("The original PDF is unavailable. Upload the PDF or sign in to fetch it.");

      const { PDFDocument: EditablePdfDocument } = await import("pdf-lib");
      const sourcePdf = await EditablePdfDocument.load(await pdfBlob.arrayBuffer());
      const pageIndexes: number[] = [];
      for (const part of splitRange.split(",")) {
        const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!match) throw new Error("Enter pages as a list or ranges, for example 1-5, 8, 10-12.");
        const first = Number(match[1]);
        const last = Number(match[2] || match[1]);
        if (first < 1 || last < first || last > sourcePdf.getPageCount()) {
          throw new Error(`Page ranges must be between 1 and ${sourcePdf.getPageCount()}.`);
        }
        for (let pageNumber = first; pageNumber <= last; pageNumber++) {
          const index = pageNumber - 1;
          if (pageIndexes.includes(index))
            throw new Error(`Page ${pageNumber} appears more than once in the range.`);
          pageIndexes.push(index);
        }
      }
      if (!pageIndexes.length) throw new Error("Select at least one page to export.");

      const outputPdf = await EditablePdfDocument.create();
      const pages = await outputPdf.copyPages(sourcePdf, pageIndexes);
      pages.forEach((page) => outputPdf.addPage(page));
      const blob = new Blob([new Uint8Array(await outputPdf.save())], { type: "application/pdf" });
      const baseName = (pdfInfo?.title || activeDoc?.title || "document").replace(
        /[^a-z0-9_-]/gi,
        "_",
      );
      downloadBlob(blob, `${baseName}_pages_${splitRange.replace(/[^0-9,-]/g, "")}.pdf`);
      setStatusMessage(
        `Exported ${pageIndexes.length} page${pageIndexes.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to export the selected pages.",
      );
    } finally {
      setIsExportingRange(false);
    }
  };

  return (
    <main className="page narrow-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">UTILITIES</span>
          <h1>PDF Toolkit</h1>
          <p>
            Inspect PDFs, extract selectable text, export page ranges, and read documents on mobile.
          </p>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf"
        style={{ display: "none" }}
        onChange={(e) => handleCustomUpload(e.target.files)}
      />

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          margin: "20px 0",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#666",
              display: "block",
              marginBottom: 6,
            }}
          >
            SELECT PDF FROM LIBRARY
          </label>
          <select
            className="settings-select"
            value={customFile ? "custom" : selectedDocId}
            onChange={(e) => {
              if (e.target.value === "custom") {
                fileInputRef.current?.click();
              } else {
                setCustomFile(null);
                setSelectedDocId(e.target.value);
              }
            }}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
          >
            {pdfItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} ({item.fileSize || "PDF"})
              </option>
            ))}
            <option value="custom">+ Choose another PDF from device…</option>
          </select>
        </div>
        <button
          className="secondary"
          onClick={() => fileInputRef.current?.click()}
          style={{ height: 42, alignSelf: "flex-end" }}
        >
          <Upload size={15} /> Upload PDF
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          borderBottom: "1px solid #eee",
          paddingBottom: 12,
          marginBottom: 20,
          overflowX: "auto",
        }}
      >
        {[
          ["metadata", "Inspect & Metadata"],
          ["extract", "Text & Content Extractor"],
          ["split", "Page Scrubber & Split"],
          ["optimize", "Mobile Optimizer"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTool(key as any)}
            className="select-btn"
            style={{
              padding: "8px 14px",
              fontSize: 12,
              borderRadius: 6,
              background: activeTool === key ? "#111" : "transparent",
              color: activeTool === key ? "#fff" : "inherit",
              border: activeTool === key ? "1px solid #111" : "1px solid #e0deda",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {statusMessage && (
        <div
          role={isProcessing ? "status" : "alert"}
          style={{
            padding: "16px",
            background:
              statusMessage.startsWith("Unable") ||
              statusMessage.startsWith("Enter") ||
              statusMessage.startsWith("Page ")
                ? "#fef2f2"
                : "#f8f8f8",
            borderRadius: 8,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            color:
              statusMessage.startsWith("Unable") ||
              statusMessage.startsWith("Enter") ||
              statusMessage.startsWith("Page ")
                ? "#b42318"
                : "#555",
          }}
        >
          {isProcessing ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}
          {statusMessage}
        </div>
      )}

      {activeTool === "metadata" && (
        <section className="settings-section-card">
          <h2>Document Metadata</h2>
          <p>Detailed technical structure and embedded catalog attributes.</p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            <div
              style={{
                padding: "14px",
                background: "#fafafa",
                borderRadius: 8,
                border: "1px solid #eee",
              }}
            >
              <small
                style={{
                  fontSize: 10,
                  color: "#888",
                  display: "block",
                  textTransform: "uppercase",
                }}
              >
                Total Pages
              </small>
              <b style={{ fontSize: 20, color: "#111" }}>{pdfInfo?.pageCount ?? "…"}</b>
            </div>
            <div
              style={{
                padding: "14px",
                background: "#fafafa",
                borderRadius: 8,
                border: "1px solid #eee",
              }}
            >
              <small
                style={{
                  fontSize: 10,
                  color: "#888",
                  display: "block",
                  textTransform: "uppercase",
                }}
              >
                Extracted Words
              </small>
              <b style={{ fontSize: 20, color: "#111" }}>
                {pdfInfo?.wordCount ? pdfInfo.wordCount.toLocaleString() : "…"}
              </b>
            </div>
            <div
              style={{
                padding: "14px",
                background: "#fafafa",
                borderRadius: 8,
                border: "1px solid #eee",
              }}
            >
              <small
                style={{
                  fontSize: 10,
                  color: "#888",
                  display: "block",
                  textTransform: "uppercase",
                }}
              >
                File Size
              </small>
              <b style={{ fontSize: 20, color: "#111" }}>
                {pdfInfo?.fileSize || activeDoc?.fileSize || "…"}
              </b>
            </div>
          </div>
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="settings-row-item">
              <label>
                Document Title<small>Catalog /Title identifier</small>
              </label>
              <b>{pdfInfo?.title || activeDoc?.title || "None specified"}</b>
            </div>
            <div className="settings-row-item">
              <label>
                Document Author<small>Catalog /Author field</small>
              </label>
              <b>{pdfInfo?.author || activeDoc?.author || "Unknown"}</b>
            </div>
          </div>
          {activeDoc && !customFile && (
            <div style={{ marginTop: 20 }}>
              <button
                className="btn primary"
                onClick={() => onOpenReader(activeDoc as LibraryItem)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  borderRadius: 8,
                  background: "#111",
                  color: "#fff",
                  cursor: "pointer",
                  border: 0,
                }}
              >
                <BookOpen size={16} /> Open Document in CLIO Reader
              </button>
            </div>
          )}
        </section>
      )}

      {activeTool === "extract" && (
        <section className="settings-section-card">
          <h2>Extracted Text Content</h2>
          <p>
            Selectable text extracted from every page. Scanned pages require OCR and are not
            included.
          </p>
          <div style={{ marginTop: 14 }}>
            <textarea
              readOnly
              rows={12}
              value={pdfInfo?.extractedTextSample || "No text streams found in this PDF."}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                fontFamily: "monospace",
                fontSize: 12,
                lineHeight: 1.6,
                background: "#fafafa",
              }}
            />
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <button
              className="btn primary"
              onClick={handleDownloadExtractedText}
              disabled={!pdfInfo?.extractedTextSample}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 16px",
                borderRadius: 8,
                background: "#111",
                color: "#fff",
                cursor: "pointer",
                border: 0,
              }}
            >
              <Download size={15} /> Download as Plain Text (.txt)
            </button>
          </div>
        </section>
      )}

      {activeTool === "split" && (
        <section className="settings-section-card">
          <h2>Page Range & Splitter</h2>
          <p>Select specific page boundaries to read or export.</p>
          <div className="pdf-range-controls">
            <label>
              Page Range:
              <input
                type="text"
                value={splitRange}
                onChange={(e) => setSplitRange(e.target.value)}
                aria-label="PDF pages to export"
                placeholder="e.g. 1-5, 8"
              />
            </label>
            <button
              className="btn secondary"
              onClick={handleExportPageRange}
              disabled={isExportingRange || isProcessing}
            >
              {isExportingRange ? (
                <>
                  <Loader2 size={15} className="spin" /> Exporting…
                </>
              ) : (
                <>
                  <Download size={15} /> Export Selected Pages
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {activeTool === "optimize" && (
        <section className="settings-section-card">
          <h2>Mobile Reading</h2>
          <p>
            CLIO adapts PDF pages and reading controls to your screen. Availability depends on the
            original file and browser support.
          </p>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                color: "#166534",
                fontSize: 12,
              }}
            >
              <Check size={16} /> <b>Offline PDF cache:</b> Imported PDFs are stored on this device
              for offline reading.
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                color: "#166534",
                fontSize: 12,
              }}
            >
              <Check size={16} /> <b>Responsive reading:</b> Text, page controls, and navigation
              adapt to phone and tablet screens.
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 8,
                color: "#854d0e",
                fontSize: 12,
              }}
            >
              <CircleHelp size={16} /> <b>Scanned-page OCR:</b> Not available. Scanned PDF pages
              need selectable text before they can be extracted or converted.
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

// ─── Analytics Page ───────────────────────────────────────────────────────────
function AnalyticsPage({ items }: { items: LibraryItem[] }) {
  const totalItems = items.length;
  const inProgress = items.filter((i) => i.progress > 0 && i.progress < 100).length;
  const completed = items.filter((i) => i.progress >= 100).length;
  const avgProgress =
    items.length > 0 ? Math.round(items.reduce((s, i) => s + i.progress, 0) / items.length) : 0;

  const byType: Record<string, number> = {};
  items.forEach((i) => {
    byType[i.type] = (byType[i.type] || 0) + 1;
  });
  const topTypes = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">INSIGHTS</span>
          <h1>Reading Analytics</h1>
          <p>Your reading patterns, progress, and knowledge growth.</p>
        </div>
      </div>
      <div className="metric-grid">
        {[
          [totalItems.toString(), "Library items", "total"],
          [inProgress.toString(), "In progress", "active"],
          [completed.toString(), "Completed", "done"],
          [`${avgProgress}%`, "Avg. progress", "across all items"],
        ].map((x) => (
          <div className="metric" key={x[1]}>
            <span>{x[1]}</span>
            <strong>{x[0]}</strong>
            <small>{x[2]}</small>
          </div>
        ))}
      </div>
      {totalItems === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#888" }}>
          <BarChart3 size={40} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p>Import documents to see your analytics.</p>
        </div>
      ) : (
        <div className="analytics-grid">
          <section className="panel wide">
            <div className="section-title">
              <div>
                <span className="eyebrow">COLLECTION</span>
                <h2>Progress overview</h2>
              </div>
            </div>
            <div className="big-chart">
              {items.slice(0, 28).map((item, i) => (
                <span
                  key={i}
                  style={{ height: `${Math.max(8, item.progress)}px` }}
                  className={item.progress > 50 ? "active" : ""}
                  title={`${item.title}: ${item.progress}%`}
                />
              ))}
            </div>
            <div className="chart-labels">
              {items.length > 0 && <span>{items[0]?.title?.slice(0, 12)}</span>}
              {items.length > 7 && (
                <span>{items[Math.floor(items.length / 4)]?.title?.slice(0, 12)}</span>
              )}
              {items.length > 14 && (
                <span>{items[Math.floor(items.length / 2)]?.title?.slice(0, 12)}</span>
              )}
              {items.length > 21 && (
                <span>{items[Math.floor((3 * items.length) / 4)]?.title?.slice(0, 12)}</span>
              )}
              {items.length > 1 && <span>{items[items.length - 1]?.title?.slice(0, 12)}</span>}
            </div>
          </section>
          <section className="panel">
            <span className="eyebrow">FORMATS</span>
            <h2>File types</h2>
            <div className="knowledge-list">
              {topTypes.map(([type, count]) => (
                <div key={type}>
                  <span>{type}</span>
                  <b>{count}</b>
                  <Progress value={(count / Math.max(1, totalItems)) * 100} />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function SettingsPage({
  user,
  token,
  onSignOut,
  onSignIn,
}: {
  user: User | null;
  token: string | null;
  onSignOut: () => void;
  onSignIn: () => void;
}) {
  const [readingFont, setReadingFont] = useState(
    () => localStorage.getItem("clio_reader_font") || "Georgia",
  );
  const [fontSize, setFontSize] = useState(() =>
    localStorage.getItem("clio_reader_font_size")
      ? `${localStorage.getItem("clio_reader_font_size")}px`
      : "16px",
  );
  const [autoSync, setAutoSync] = useState(
    () => localStorage.getItem("clio_auto_sync") !== "false",
  );
  const [aiContextLimit, setAiContextLimit] = useState(
    () => localStorage.getItem("clio_ai_context") || "5",
  );
  const [databaseStatus, setDatabaseStatus] = useState("Checking backend…");
  const [apiUrl, setApiUrl] = useState(
    () =>
      localStorage.getItem(apiBaseStorageKey) ||
      (isAndroidApp ? "http://10.0.2.2:8000" : "http://localhost:8000"),
  );
  const [apiUrlMessage, setApiUrlMessage] = useState("");

  useEffect(() => {
    let active = true;
    const healthBases = getApiBases().map((base) => base.replace(/\/api\/v1$/, ""));
    (async () => {
      let lastError: unknown = null;
      for (const base of healthBases) {
        try {
          const health = await checkApiHealth(base);
          if (active)
            setDatabaseStatus(
              health.database === "connected" ? "MongoDB connected" : "MongoDB unavailable",
            );
          return;
        } catch (error) {
          lastError = error;
        }
      }
      if (active) {
        const message = lastError instanceof Error ? lastError.message : "";
        setDatabaseStatus(
          message.includes("MongoDB") ? "MongoDB unavailable" : "Backend unavailable",
        );
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const testApiConnection = async () => {
    const normalized = normalizeApiOrigin(apiUrl);
    if (!normalized) {
      localStorage.removeItem(apiBaseStorageKey);
      setApiUrlMessage("Using the default CLIO API address.");
      return;
    }
    setApiUrlMessage("Testing connection…");
    try {
      const health = await checkApiHealth(normalized);
      if (health.database !== "connected")
        throw new Error(health.detail || "Database is unavailable.");
      localStorage.setItem(apiBaseStorageKey, normalized);
      setDatabaseStatus("MongoDB connected");
      setApiUrlMessage("Connected. CLIO features can now fetch your account data.");
    } catch (error) {
      setApiUrlMessage(
        error instanceof Error ? error.message : "Unable to connect to this API address.",
      );
    }
  };

  const handleFontChange = (val: string) => {
    setReadingFont(val);
    localStorage.setItem("clio_reader_font", val);
  };

  const handleFontSizeChange = (val: string) => {
    setFontSize(val);
    const num = parseInt(val, 10);
    if (!isNaN(num)) localStorage.setItem("clio_reader_font_size", num.toString());
  };

  const handleAutoSyncChange = (val: boolean) => {
    setAutoSync(val);
    localStorage.setItem("clio_auto_sync", val.toString());
  };

  const handleAiContextChange = (val: string) => {
    setAiContextLimit(val);
    localStorage.setItem("clio_ai_context", val);
  };

  return (
    <main className="page narrow-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PREFERENCES & ACCOUNT</span>
          <h1>Settings</h1>
          <p>Customize your reading experience, AI engine, and workspace settings.</p>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <section className="settings-section-card">
          <h2>Reader Experience</h2>
          <p>Control defaults for reading PDFs, books, and documents.</p>
          <div className="settings-row-item">
            <label>
              Reading Typography
              <small>Font family applied to document pages</small>
            </label>
            <select
              className="settings-select"
              value={readingFont}
              onChange={(e) => handleFontChange(e.target.value)}
            >
              <option value="Georgia">Georgia (Serif)</option>
              <option value="Inter">Inter (Sans-Serif)</option>
              <option value="Merriweather">Merriweather (Editorial)</option>
              <option value="Courier New">Monospace (Code / Raw)</option>
            </select>
          </div>
          <div className="settings-row-item">
            <label>
              Default Font Size
              <small>Adjust base text scale in Reader</small>
            </label>
            <select
              className="settings-select"
              value={fontSize}
              onChange={(e) => handleFontSizeChange(e.target.value)}
            >
              <option value="14px">Small (14px)</option>
              <option value="16px">Standard (16px)</option>
              <option value="18px">Comfortable (18px)</option>
              <option value="20px">Large (20px)</option>
            </select>
          </div>
          <div className="settings-row-item">
            <label>
              Background Sync
              <small>Automatically save reading progress & chapter location to cloud</small>
            </label>
            <button
              className={`settings-toggle ${autoSync ? "active" : ""}`}
              onClick={() => handleAutoSyncChange(!autoSync)}
              aria-label="Toggle auto sync"
              aria-pressed={autoSync}
            />
          </div>
        </section>

        <section className="settings-section-card">
          <h2>CLIO Intelligence & AI Engine</h2>
          <p>Configure Google Gemini document understanding and search citations.</p>
          <div className="settings-row-item">
            <label>
              AI Context Window
              <small>Number of retrieved document chunks sent to Gemini</small>
            </label>
            <select
              className="settings-select"
              value={aiContextLimit}
              onChange={(e) => handleAiContextChange(e.target.value)}
            >
              <option value="3">Fast (3 chunks)</option>
              <option value="5">Balanced (5 chunks)</option>
              <option value="10">Deep Analysis (10 chunks)</option>
            </select>
          </div>
          <div className="settings-row-item">
            <label>
              Connected AI Model
              <small>Model powering question answering and summarization</small>
            </label>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#2563eb",
                background: "rgba(37, 99, 235, 0.08)",
                padding: "4px 8px",
                borderRadius: 6,
              }}
            >
              Gemini 3.1 Flash Lite (Online)
            </span>
          </div>
        </section>

        <section className="settings-section-card">
          <h2>Account & Data</h2>
          <p>Manage your login credentials, cloud database connection, and storage.</p>
          <div className="api-connection">
            <label>
              Backend API address
              <small>
                Use the computer’s LAN address on a physical Android phone, for example
                http://192.168.100.10:8000
              </small>
            </label>
            <input
              value={apiUrl}
              onChange={(event) => setApiUrl(event.target.value)}
              placeholder="http://192.168.100.10:8000"
            />
            <button className="secondary" onClick={testApiConnection}>
              Test connection
            </button>
            {apiUrlMessage && (
              <small className="api-connection-message" role="status">
                {apiUrlMessage}
              </small>
            )}
          </div>
          <div className="settings-row-item">
            <label>
              {user ? user.full_name || user.email : "Guest Mode"}
              <small>
                {token ? `Signed in · ${databaseStatus}` : `Signed out · ${databaseStatus}`}
              </small>
            </label>
            {user ? (
              <button className="secondary" onClick={onSignOut}>
                <LogOut size={14} /> Sign out
              </button>
            ) : (
              <button className="primary" onClick={onSignIn}>
                <LogIn size={14} /> Sign in / Register
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

// ─── Help & Support Page ──────────────────────────────────────────────────────
function HelpPage({ go, openImport }: { go: (p: Page) => void; openImport: () => void }) {
  return (
    <main className="page narrow-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ASSISTANCE & GUIDES</span>
          <h1>Help & Support</h1>
          <p>Everything you need to know about reading, annotating, and querying in CLIO.</p>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <section className="settings-section-card">
          <h2>Frequently Asked Questions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
            <div>
              <b style={{ fontSize: 13 }}>How do I read multi-page PDFs?</b>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666" }}>
                Click "Import files" and select your PDF. CLIO extracts selectable text from every
                page and tracks your reading progress. Scanned pages can still be viewed as a PDF,
                but OCR is not available, so their text cannot be searched or used for AI answers.
              </p>
            </div>
            <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
              <b style={{ fontSize: 13 }}>How does Ask Your Library work?</b>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666" }}>
                CLIO chunks your uploaded documents and indexes them in MongoDB. When you ask a
                question, our AI retrieves the exact matching passages and cites them directly with
                chapter and page references.
              </p>
            </div>
            <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
              <b style={{ fontSize: 13 }}>Can I take notes and make highlights?</b>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666" }}>
                Yes! While in the Reader, select any text to create a highlight or click "Add a
                note" in the right sidebar. Notes are saved to your account and accessible anytime.
              </p>
            </div>
          </div>
        </section>

        <section className="settings-section-card">
          <h2>Quick Guides</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <button
              onClick={openImport}
              style={{
                padding: 14,
                border: "1px solid #eee",
                borderRadius: 10,
                background: "#fafafa",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <Upload size={18} style={{ marginBottom: 6, color: "#111" }} />
              <b style={{ display: "block", fontSize: 13 }}>Upload a Document</b>
              <small style={{ color: "#777", fontSize: 11 }}>
                Supports PDF, EPUB, DOCX, TXT, MD, and more
              </small>
            </button>
            <button
              onClick={() => go("Ask Your Library")}
              style={{
                padding: 14,
                border: "1px solid #eee",
                borderRadius: 10,
                background: "#fafafa",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <Sparkles size={18} style={{ marginBottom: 6, color: "#111" }} />
              <b style={{ display: "block", fontSize: 13 }}>Ask AI Questions</b>
              <small style={{ color: "#777", fontSize: 11 }}>
                Synthesize concepts across all your books
              </small>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthRequired({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="settings-section-card" style={{ marginTop: 24, textAlign: "center" }}>
      <h2>Sign in to sync with MongoDB</h2>
      <p>Your collections, notes, study cards, and reading activity are saved to your account.</p>
      <button className="primary" onClick={onSignIn}>
        <LogIn size={15} /> Sign in / Register
      </button>
    </div>
  );
}

type CollectionRecord = {
  id: string;
  name: string;
  description?: string;
  item_count: number;
};

function CollectionsPage({
  items,
  token,
  onSignIn,
  openReader,
}: {
  items: LibraryItem[];
  token: string | null;
  onSignIn: () => void;
  openReader: (d: LibraryItem) => void;
}) {
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [collectionItems, setCollectionItems] = useState<
    { id: string; title: string; author: string }[]
  >([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!token) return;
    try {
      const data = await apiFetch("/collections", {}, token);
      setCollections(data);
      if (selectedId && !data.some((entry: CollectionRecord) => entry.id === selectedId)) {
        setSelectedId("");
        setCollectionItems([]);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    refresh();
  }, [token]);
  useEffect(() => {
    if (!token || !selectedId) return;
    apiFetch(`/collections/${selectedId}/items`, {}, token)
      .then(setCollectionItems)
      .catch((e) => setError((e as Error).message));
  }, [token, selectedId]);

  if (!token)
    return (
      <main className="page">
        <div className="page-heading">
          <h1>Collections</h1>
          <p>Organize your books and research.</p>
        </div>
        <AuthRequired onSignIn={onSignIn} />
      </main>
    );

  const saveCollection = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (editingId) {
        await apiFetch(
          `/collections/${editingId}`,
          { method: "PATCH", body: JSON.stringify({ name: name.trim() }) },
          token,
        );
      } else {
        await apiFetch(
          "/collections",
          { method: "POST", body: JSON.stringify({ name: name.trim() }) },
          token,
        );
      }
      setName("");
      setEditingId(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteCollection = async (id: string) => {
    try {
      await apiFetch(`/collections/${id}`, { method: "DELETE" }, token);
      if (selectedId === id) {
        setSelectedId("");
        setCollectionItems([]);
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const addItem = async (itemId: string) => {
    if (!selectedId) return;
    try {
      await apiFetch(
        `/collections/${selectedId}/items`,
        { method: "POST", body: JSON.stringify({ library_item_id: itemId }) },
        token,
      );
      await refresh();
      setCollectionItems(await apiFetch(`/collections/${selectedId}/items`, {}, token));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      await apiFetch(`/collections/${selectedId}/items/${itemId}`, { method: "DELETE" }, token);
      await refresh();
      setCollectionItems((current) => current.filter((entry) => entry.id !== itemId));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ORGANIZATION</span>
          <h1>Collections</h1>
          <p>Collections are saved to your MongoDB account.</p>
        </div>
      </div>
      <div className="collection-form">
        <input
          placeholder={editingId ? "Rename collection..." : "New collection title..."}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="primary" disabled={busy || !name.trim()} onClick={saveCollection}>
          <Plus size={15} /> {editingId ? "Save" : "Add Collection"}
        </button>
        {editingId && (
          <button
            className="secondary"
            onClick={() => {
              setEditingId(null);
              setName("");
            }}
          >
            Cancel
          </button>
        )}
      </div>
      {error && (
        <p role="alert" style={{ color: "#b42318" }}>
          {error}
        </p>
      )}
      {collections.length === 0 && <p>No collections yet. Create one to get started.</p>}
      <div
        className="collections-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
          gap: 16,
        }}
      >
        {collections.map((collection) => (
          <section
            key={collection.id}
            className="settings-section-card"
            style={{ marginBottom: 0 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Folder size={20} />
              <button className="secondary" onClick={() => setSelectedId(collection.id)}>
                {collection.name}
              </button>
              <span style={{ marginLeft: "auto" }}>{collection.item_count} items</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="secondary"
                onClick={() => {
                  setEditingId(collection.id);
                  setName(collection.name);
                }}
              >
                Rename
              </button>
              <button className="secondary" onClick={() => deleteCollection(collection.id)}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
            {selectedId === collection.id && (
              <div style={{ marginTop: 14 }}>
                <select
                  aria-label="Add book to collection"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) addItem(e.target.value);
                  }}
                >
                  <option value="">Add an item…</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
                {collectionItems.map((item) => (
                  <div
                    key={item.id}
                    style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}
                  >
                    <button
                      className="secondary"
                      onClick={() => {
                        const match = items.find((entry) => entry.id === item.id);
                        if (match) openReader(match);
                      }}
                    >
                      {item.title}
                    </button>
                    <button
                      className="secondary"
                      aria-label={`Remove ${item.title}`}
                      onClick={() => removeItem(item.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}

type FlashcardRecord = {
  id: string;
  question: string;
  answer: string;
  difficulty: string;
  library_item_id?: string;
};

function LibraryBookPicker({
  items,
  selectedId,
  onSelect,
  label = "Choose from your library",
}: {
  items: LibraryItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  label?: string;
}) {
  if (items.length === 0) {
    return <p className="library-picker-empty">Your library is empty. Import a book first.</p>;
  }
  return (
    <div className="library-picker">
      <div className="library-picker-heading">
        <span>{label}</span>
        <small>{items.length} saved</small>
      </div>
      <select
        className="library-picker-select"
        value={selectedId}
        onChange={(event) => onSelect(event.target.value)}
        aria-label={label}
      >
        <option value="">Choose a book…</option>
        {items.map((item) => (
          <option value={item.id} key={item.id}>
            {item.title} · {item.author} · {item.type}
          </option>
        ))}
      </select>
    </div>
  );
}

function StudyPage({
  items,
  token,
  onSignIn,
}: {
  items: LibraryItem[];
  token: string | null;
  onSignIn: () => void;
}) {
  const [cards, setCards] = useState<FlashcardRecord[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showAnswers, setShowAnswers] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    if (!token) return;
    try {
      setCards(await apiFetch("/study/flashcards", {}, token));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    refresh();
  }, [token]);

  if (!token)
    return (
      <main className="page">
        <div className="page-heading">
          <h1>Study Workspace</h1>
          <p>Review and manage your flashcards.</p>
        </div>
        <AuthRequired onSignIn={onSignIn} />
      </main>
    );

  const save = async () => {
    try {
      const payload = {
        question: question.trim(),
        answer: answer.trim(),
        library_item_id: sourceId || null,
      };
      await apiFetch(
        editingId ? `/study/flashcards/${editingId}` : "/study/flashcards",
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
        token,
      );
      setQuestion("");
      setAnswer("");
      setSourceId("");
      setEditingId(null);
      setError("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const edit = (card: FlashcardRecord) => {
    setEditingId(card.id);
    setQuestion(card.question);
    setAnswer(card.answer);
    setSourceId(card.library_item_id || "");
  };

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACTIVE RECALL</span>
          <h1>Study Workspace</h1>
          <p>Create and review flashcards stored in MongoDB.</p>
        </div>
      </div>
      <section className="settings-section-card study-form" style={{ marginTop: 20 }}>
        <h2>{editingId ? "Edit flashcard" : "Create a flashcard"}</h2>
        <input
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <textarea
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={3}
        />
        <LibraryBookPicker items={items} selectedId={sourceId} onSelect={setSourceId} />
        {error && (
          <p role="alert" style={{ color: "#b42318" }}>
            {error}
          </p>
        )}
        <button className="primary" disabled={!question.trim() || !answer.trim()} onClick={save}>
          {editingId ? "Save changes" : "Add flashcard"}
        </button>
        {editingId && (
          <button
            className="secondary"
            onClick={() => {
              setEditingId(null);
              setQuestion("");
              setAnswer("");
              setSourceId("");
            }}
          >
            Cancel
          </button>
        )}
      </section>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 14,
          marginTop: 18,
        }}
      >
        {cards.map((card) => (
          <article key={card.id} className="settings-section-card" style={{ marginBottom: 0 }}>
            <b>{card.question}</b>
            {showAnswers[card.id] && <p>{card.answer}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="secondary"
                onClick={() => setShowAnswers((old) => ({ ...old, [card.id]: !old[card.id] }))}
              >
                {showAnswers[card.id] ? "Hide answer" : "Show answer"}
              </button>
              <button className="secondary" onClick={() => edit(card)}>
                Edit
              </button>
              <button
                className="secondary"
                aria-label="Delete flashcard"
                onClick={async () => {
                  try {
                    await apiFetch(`/study/flashcards/${card.id}`, { method: "DELETE" }, token);
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {cards.length === 0 && (
        <p style={{ marginTop: 20 }}>No flashcards yet. Add your first card above.</p>
      )}
    </main>
  );
}

type HighlightRecord = {
  id: string;
  library_item_id: string;
  highlighted_text: string;
  location: string;
  note?: string;
};

function HighlightsPage({
  items,
  token,
  onSignIn,
}: {
  items: LibraryItem[];
  token: string | null;
  onSignIn: () => void;
}) {
  const [highlights, setHighlights] = useState<HighlightRecord[]>([]);
  const [itemId, setItemId] = useState("");
  const [text, setText] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const refresh = async () => {
    if (!token) return;
    try {
      setHighlights(await apiFetch("/highlights", {}, token));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    refresh();
  }, [token]);
  if (!token)
    return (
      <main className="page">
        <div className="page-heading">
          <h1>Highlights</h1>
          <p>Your saved passages and notes.</p>
        </div>
        <AuthRequired onSignIn={onSignIn} />
      </main>
    );
  const save = async () => {
    try {
      const payload = editingId
        ? { highlighted_text: text, location, note: note || null }
        : { library_item_id: itemId, highlighted_text: text, location, note: note || null };
      await apiFetch(
        editingId ? `/highlights/${editingId}` : "/highlights",
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
        token,
      );
      setText("");
      setLocation("");
      setNote("");
      setItemId("");
      setEditingId(null);
      setError("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const exportHighlights = () => {
    const markdown = [
      "# CLIO Highlights",
      "",
      ...highlights.flatMap((highlight) => {
        const title =
          items.find((item) => item.id === highlight.library_item_id)?.title || "Library item";
        return [
          `## ${title} · ${highlight.location}`,
          "",
          `> ${highlight.highlighted_text}`,
          ...(highlight.note ? ["", highlight.note] : []),
          "",
        ];
      }),
    ].join("\n");
    downloadTextFile("clio-highlights.md", markdown, "text/markdown;charset=utf-8");
  };
  const exportHighlightsDocument = async (format: "PDF" | "DOCX") => {
    try {
      const markdown = highlights
        .map((highlight) => {
          const title =
            items.find((item) => item.id === highlight.library_item_id)?.title || "Library item";
          return `${title} · ${highlight.location}\n${highlight.highlighted_text}${highlight.note ? `\nNote: ${highlight.note}` : ""}`;
        })
        .join("\n\n");
      const blob = await convertDocumentText(
        markdown || "No highlights saved yet.",
        format,
        "CLIO Highlights",
      );
      downloadBlob(blob, `clio-highlights.${format.toLowerCase()}`);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : `Unable to export highlights as ${format}.`,
      );
    }
  };
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">READING MEMORY</span>
          <h1>Highlights</h1>
          <p>Capture and revisit passages saved to your account.</p>
        </div>
        <div className="highlight-export-actions">
          <button className="secondary" onClick={exportHighlights} disabled={!highlights.length}>
            <Download size={14} /> Markdown
          </button>
          <button
            className="secondary"
            onClick={() => void exportHighlightsDocument("PDF")}
            disabled={!highlights.length}
          >
            PDF
          </button>
          <button
            className="secondary"
            onClick={() => void exportHighlightsDocument("DOCX")}
            disabled={!highlights.length}
          >
            DOCX
          </button>
        </div>
      </div>
      <section className="settings-section-card profile-form" style={{ marginTop: 20 }}>
        <h2>{editingId ? "Edit highlight" : "Save a highlight"}</h2>
        {!editingId && (
          <LibraryBookPicker
            items={items}
            selectedId={itemId}
            onSelect={setItemId}
            label="Highlight a book from your library"
          />
        )}
        <textarea
          placeholder="Highlighted text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        <input
          placeholder="Page or location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <input placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
        {error && (
          <p role="alert" style={{ color: "#b42318" }}>
            {error}
          </p>
        )}
        <button
          className="primary"
          disabled={!text.trim() || !location.trim() || (!editingId && !itemId)}
          onClick={save}
        >
          {editingId ? "Save changes" : "Add highlight"}
        </button>
        {editingId && (
          <button
            className="secondary"
            onClick={() => {
              setEditingId(null);
              setText("");
              setLocation("");
              setNote("");
            }}
          >
            Cancel
          </button>
        )}
      </section>
      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        {highlights.map((highlight) => (
          <article key={highlight.id} className="settings-section-card" style={{ marginBottom: 0 }}>
            <blockquote style={{ margin: 0, borderLeft: "3px solid #111", paddingLeft: 14 }}>
              {highlight.highlighted_text}
            </blockquote>
            <small>
              {items.find((item) => item.id === highlight.library_item_id)?.title || "Library item"}{" "}
              · {highlight.location}
            </small>
            {highlight.note && <p>{highlight.note}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="secondary"
                onClick={() =>
                  downloadQuoteImage(
                    items.find((item) => item.id === highlight.library_item_id)?.title ||
                      "CLIO Highlight",
                    highlight.highlighted_text,
                  )
                }
              >
                <Share2 size={14} /> Share as image
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setEditingId(highlight.id);
                  setText(highlight.highlighted_text);
                  setLocation(highlight.location);
                  setNote(highlight.note || "");
                }}
              >
                Edit
              </button>
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await apiFetch(`/highlights/${highlight.id}`, { method: "DELETE" }, token);
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </article>
        ))}
        {highlights.length === 0 && <p>No highlights saved yet.</p>}
      </div>
    </main>
  );
}

type GraphNode = { id: string; label: string; node_type: string; description?: string };
type GraphEdge = {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type: string;
};

function KnowledgeGraphPage({
  items,
  token,
  onSignIn,
}: {
  items: LibraryItem[];
  token: string | null;
  onSignIn: () => void;
}) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [label, setLabel] = useState("");
  const [nodeType, setNodeType] = useState("concept");
  const [sourceItemId, setSourceItemId] = useState("");
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [edgeSource, setEdgeSource] = useState("");
  const [edgeTarget, setEdgeTarget] = useState("");
  const [relationship, setRelationship] = useState("related to");
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const refresh = async () => {
    if (!token) return;
    try {
      const data = await apiFetch("/knowledge", {}, token);
      setNodes(data.nodes);
      setEdges(data.edges);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    refresh();
  }, [token]);
  if (!token)
    return (
      <main className="page">
        <div className="page-heading">
          <h1>Knowledge Graph</h1>
          <p>Connect ideas across your reading.</p>
        </div>
        <AuthRequired onSignIn={onSignIn} />
      </main>
    );
  const saveNode = async () => {
    try {
      const payload = editingNodeId
        ? { label, node_type: nodeType }
        : { label, node_type: nodeType, source_item_id: sourceItemId || null };
      await apiFetch(
        editingNodeId ? `/knowledge/nodes/${editingNodeId}` : "/knowledge/nodes",
        { method: editingNodeId ? "PATCH" : "POST", body: JSON.stringify(payload) },
        token,
      );
      setLabel("");
      setSourceItemId("");
      setEditingNodeId(null);
      setError("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const saveEdge = async () => {
    try {
      await apiFetch(
        editingEdgeId ? `/knowledge/edges/${editingEdgeId}` : "/knowledge/edges",
        {
          method: editingEdgeId ? "PATCH" : "POST",
          body: JSON.stringify(
            editingEdgeId
              ? { relationship_type: relationship }
              : {
                  source_node_id: edgeSource,
                  target_node_id: edgeTarget,
                  relationship_type: relationship,
                },
          ),
        },
        token,
      );
      setRelationship("related to");
      setEditingEdgeId(null);
      setError("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CONNECTED IDEAS</span>
          <h1>Knowledge Graph</h1>
          <p>Build and maintain concept nodes and their relationships.</p>
        </div>
      </div>
      {error && (
        <p className="graph-error" role="alert">
          {error}
        </p>
      )}
      <section className="settings-section-card graph-form" style={{ marginTop: 20 }}>
        <h2>{editingNodeId ? "Edit concept" : "Add a concept"}</h2>
        <input
          placeholder="Concept name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          placeholder="Type (concept, person, topic…)"
          value={nodeType}
          onChange={(e) => setNodeType(e.target.value)}
        />
        {!editingNodeId && (
          <LibraryBookPicker
            items={items}
            selectedId={sourceItemId}
            onSelect={setSourceItemId}
            label="Link this concept to a library book (optional)"
          />
        )}
        <button className="primary" disabled={!label.trim()} onClick={saveNode}>
          {editingNodeId ? "Save concept" : "Add concept"}
        </button>
        {editingNodeId && (
          <button
            className="secondary"
            onClick={() => {
              setEditingNodeId(null);
              setLabel("");
            }}
          >
            Cancel
          </button>
        )}
      </section>
      <section className="settings-section-card graph-form">
        <h2>{editingEdgeId ? "Edit relationship" : "Connect concepts"}</h2>
        {!editingEdgeId && (
          <div className="graph-edge-fields">
            <select value={edgeSource} onChange={(e) => setEdgeSource(e.target.value)}>
              <option value="">From concept…</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label}
                </option>
              ))}
            </select>
            <select value={edgeTarget} onChange={(e) => setEdgeTarget(e.target.value)}>
              <option value="">To concept…</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <input
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          aria-label="Relationship type"
        />
        <button
          className="primary"
          disabled={
            !relationship.trim() ||
            (!editingEdgeId && (!edgeSource || !edgeTarget || edgeSource === edgeTarget))
          }
          onClick={saveEdge}
        >
          {editingEdgeId ? "Save relationship" : "Add relationship"}
        </button>
        {editingEdgeId && (
          <button className="secondary" onClick={() => setEditingEdgeId(null)}>
            Cancel
          </button>
        )}
      </section>
      <div className="graph-node-grid">
        {nodes.map((node) => (
          <article
            key={node.id}
            className="settings-section-card graph-node-card"
            style={{ marginBottom: 0 }}
          >
            <small>{node.node_type}</small>
            <h2>{node.label}</h2>
            <div className="graph-card-actions">
              <button
                className="secondary"
                onClick={() => {
                  setEditingNodeId(node.id);
                  setLabel(node.label);
                  setNodeType(node.node_type);
                }}
              >
                Edit
              </button>
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await apiFetch(`/knowledge/nodes/${node.id}`, { method: "DELETE" }, token);
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </article>
        ))}
      </div>
      <section className="settings-section-card graph-relationships">
        <h2>Relationships ({edges.length})</h2>
        {edges.map((edge) => (
          <div className="graph-relationship" key={edge.id}>
            <span>
              {nodes.find((node) => node.id === edge.source_node_id)?.label || "Concept"} —{" "}
              {edge.relationship_type} →{" "}
              {nodes.find((node) => node.id === edge.target_node_id)?.label || "Concept"}
            </span>
            <div>
              <button
                className="secondary"
                onClick={() => {
                  setEditingEdgeId(edge.id);
                  setRelationship(edge.relationship_type);
                }}
              >
                Edit
              </button>
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await apiFetch(`/knowledge/edges/${edge.id}`, { method: "DELETE" }, token);
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {nodes.length === 0 && <p>Add concepts to start your knowledge graph.</p>}
      </section>
    </main>
  );
}

type ProgressRecord = {
  id: string;
  library_item_id: string;
  current_page: number;
  total_pages: number;
  progress_percentage: number;
  reading_duration_seconds: number;
};
type ReadingSessionRecord = {
  id: string;
  library_item_id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds: number;
  pages_read: number;
  session_status: string;
};

function ReadingDashboardPage({
  items,
  token,
  onSignIn,
}: {
  items: LibraryItem[];
  token: string | null;
  onSignIn: () => void;
}) {
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [sessions, setSessions] = useState<ReadingSessionRecord[]>([]);
  const [itemId, setItemId] = useState("");
  const [error, setError] = useState("");
  const refresh = async () => {
    if (!token) return;
    try {
      const [progressData, sessionData] = await Promise.all([
        apiFetch("/reading/progress", {}, token),
        apiFetch("/reading/sessions", {}, token),
      ]);
      setProgress(progressData);
      setSessions(sessionData);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    refresh();
  }, [token]);
  if (!token)
    return (
      <main className="page">
        <div className="page-heading">
          <h1>Reading Dashboard</h1>
          <p>Your persisted reading progress and sessions.</p>
        </div>
        <AuthRequired onSignIn={onSignIn} />
      </main>
    );
  const totalSeconds = sessions.reduce((total, session) => total + session.duration_seconds, 0);
  const startSession = async () => {
    if (!itemId) return;
    try {
      await apiFetch(
        "/reading/sessions",
        { method: "POST", body: JSON.stringify({ library_item_id: itemId }) },
        token,
      );
      setItemId("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const stopSession = async (session: ReadingSessionRecord) => {
    const now = new Date();
    const elapsed = Math.max(
      0,
      Math.floor((now.getTime() - new Date(session.started_at).getTime()) / 1000),
    );
    try {
      await apiFetch(
        `/reading/sessions/${session.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ended_at: now.toISOString(),
            duration_seconds: elapsed,
            session_status: "completed",
          }),
        },
        token,
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR READING</span>
          <h1>Reading Dashboard</h1>
          <p>Reading progress and sessions stored in MongoDB.</p>
        </div>
      </div>
      {error && (
        <p role="alert" style={{ color: "#b42318" }}>
          {error}
        </p>
      )}
      <div className="metric-grid">
        <div className="metric">
          <span>Books tracked</span>
          <strong>{progress.length}</strong>
        </div>
        <div className="metric">
          <span>Sessions</span>
          <strong>{sessions.length}</strong>
        </div>
        <div className="metric">
          <span>Time recorded</span>
          <strong>{Math.floor(totalSeconds / 60)} min</strong>
        </div>
      </div>
      <section className="settings-section-card reading-session-form">
        <h2>Start a reading session</h2>
        <LibraryBookPicker
          items={items}
          selectedId={itemId}
          onSelect={setItemId}
          label="Choose a book from your library"
        />
        {itemId.startsWith("local-") && (
          <p className="reading-session-note">
            This book is stored on this device. Sign in and sync it to track sessions across
            devices.
          </p>
        )}
        <button
          className="primary"
          disabled={!itemId || itemId.startsWith("local-")}
          onClick={startSession}
        >
          <Play size={14} /> Start session
        </button>
      </section>
      <section className="settings-section-card">
        <h2>Progress</h2>
        {progress.map((entry) => (
          <div
            key={entry.id}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}
          >
            <span style={{ flex: 1 }}>
              {items.find((item) => item.id === entry.library_item_id)?.title || "Library item"}
            </span>
            <b>{Math.round(entry.progress_percentage)}%</b>
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await apiFetch(
                    `/reading/progress/${entry.library_item_id}`,
                    { method: "DELETE" },
                    token,
                  );
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Trash2 size={14} /> Clear
            </button>
          </div>
        ))}
        {progress.length === 0 && <p>Progress appears here as you read.</p>}
      </section>
      <section className="settings-section-card">
        <h2>Recent sessions</h2>
        {sessions.map((session) => (
          <div
            key={session.id}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}
          >
            <span style={{ flex: 1 }}>
              {items.find((item) => item.id === session.library_item_id)?.title || "Library item"} ·{" "}
              {new Date(session.started_at).toLocaleString()}
            </span>
            <span>
              {session.session_status === "active"
                ? "In progress"
                : `${Math.round(session.duration_seconds / 60)} min`}
            </span>
            {session.session_status === "active" && (
              <button className="secondary" onClick={() => stopSession(session)}>
                Finish
              </button>
            )}
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await apiFetch(`/reading/sessions/${session.id}`, { method: "DELETE" }, token);
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {sessions.length === 0 && <p>No reading sessions recorded yet.</p>}
      </section>
    </main>
  );
}

function ProfilePage({
  token,
  user,
  onUserUpdate,
  onSignIn,
  onSignOut,
}: {
  token: string | null;
  user: User | null;
  onUserUpdate: (u: User) => void;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const [profile, setProfile] = useState<{
    id?: string;
    full_name?: string;
    username?: string;
    email?: string;
    avatar_url?: string;
    created_at?: string;
  } | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    // Initialize with cached user immediately
    if (user) {
      setFullName(user.full_name || "");
      setUsername(user.username || "");
      setAvatarUrl(user.avatar_url || "");
    }
    apiFetch("/users/profile", {}, token)
      .then((response) => {
        const data = response.data || response;
        setProfile(data);
        if (data.full_name !== undefined) setFullName(data.full_name || "");
        if (data.username !== undefined) setUsername(data.username || "");
        if (data.avatar_url !== undefined) setAvatarUrl(data.avatar_url || "");
        // Keep user in sync
        if (user) {
          const updatedUser: User = {
            ...user,
            email: data.email || user.email,
            full_name: data.full_name || user.full_name,
            username: data.username || user.username,
            avatar_url: data.avatar_url !== undefined ? data.avatar_url : user.avatar_url,
          };
          onUserUpdate(updatedUser);
        }
      })
      .catch((e) => {
        // Fall back gracefully to user prop if API fails or offline
        if (user) {
          setProfile({
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            username: user.username,
            avatar_url: user.avatar_url,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Please choose a valid image file (PNG, JPG, WEBP)." });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image size must be less than 5MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAvatarUrl(base64);
      setMessage({ type: "success", text: "Photo selected! Click 'Save Changes' to update your profile." });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token) return;
    setSaving(true);
    setMessage(null);

    const payload = {
      full_name: fullName.trim(),
      username: username.trim(),
      avatar_url: avatarUrl,
    };

    try {
      const response = await apiFetch(
        "/users/profile",
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        token,
      );
      const data = response.data || response;
      setProfile((prev) => ({ ...prev, ...data, ...payload }));
      if (user) {
        onUserUpdate({
          ...user,
          full_name: data.full_name || payload.full_name,
          username: data.username || payload.username,
          avatar_url: payload.avatar_url,
        });
      }
      setMessage({ type: "success", text: "Profile updated successfully in your account database." });
    } catch (err) {
      // Local fallback save so changes always stick even when offline
      if (user) {
        onUserUpdate({
          ...user,
          full_name: payload.full_name,
          username: payload.username,
          avatar_url: payload.avatar_url,
        });
        setMessage({ type: "success", text: "Profile updated locally (will sync when online)." });
      } else {
        setMessage({ type: "error", text: (err as Error).message || "Failed to update profile." });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <main className="page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">ACCOUNT</span>
            <h1>Profile</h1>
            <p>Manage your CLIO account profile.</p>
          </div>
        </div>
        <AuthRequired onSignIn={onSignIn} />
      </main>
    );
  }

  const effectiveEmail = profile?.email || user?.email || "";
  const effectiveName = fullName || profile?.full_name || user?.full_name || "";
  const effectiveUsername = username || profile?.username || user?.username || "";
  const effectiveAvatar = avatarUrl || profile?.avatar_url || user?.avatar_url || "";

  return (
    <main className="page narrow-page profile-redesign-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACCOUNT SETTINGS</span>
          <h1>Your Profile</h1>
          <p>Manage your public identity, database details, and account photo.</p>
        </div>
      </div>

      {message && (
        <div
          className={`profile-alert ${message.type === "success" ? "profile-alert-success" : "profile-alert-error"}`}
          role="status"
        >
          {message.type === "success" ? <Check size={16} /> : <X size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile Identity Card */}
      <section className="profile-hero-card">
        <div className="profile-avatar-wrapper">
          {effectiveAvatar ? (
            <img src={effectiveAvatar} alt={effectiveName || "Profile"} className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar-placeholder">
              {initials(effectiveName || effectiveEmail)}
            </div>
          )}
          <button
            type="button"
            className="profile-avatar-edit-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload profile picture"
            aria-label="Upload profile picture"
          >
            <Camera size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageUpload}
          />
        </div>

        <div className="profile-hero-info">
          <h2>{effectiveName || "CLIO Reader"}</h2>
          <div className="profile-hero-meta">
            <span className="profile-meta-pill username-pill">
              <AtSign size={13} />
              {effectiveUsername ? effectiveUsername : "no_username"}
            </span>
            <span className="profile-meta-pill email-pill">
              <Mail size={13} />
              {effectiveEmail || "No email"}
            </span>
            <span className="profile-meta-pill verified-pill">
              <ShieldCheck size={13} />
              Verified User
            </span>
          </div>
          {effectiveAvatar && (
            <button
              type="button"
              className="profile-remove-photo-btn"
              onClick={() => {
                setAvatarUrl("");
                setMessage({ type: "success", text: "Photo removed. Click 'Save Changes' to apply." });
              }}
            >
              Remove photo
            </button>
          )}
        </div>
      </section>

      {/* Profile Edit Form Card */}
      <section className="profile-details-card">
        <div className="profile-card-header">
          <div>
            <h3>Database Information</h3>
            <p>Your details stored in the CLIO user database.</p>
          </div>
          {loading && <Loader2 className="spin" size={18} />}
        </div>

        <form onSubmit={handleSave} className="profile-form-grid">
          <label className="profile-field">
            <span className="field-label">
              <User size={14} /> Full Name
            </span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Eleanor Vance"
              required
            />
            <small className="field-hint">Your display name shown on reviews, notes, and activity.</small>
          </label>

          <label className="profile-field">
            <span className="field-label">
              <AtSign size={14} /> Username
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. eleanor_vance"
              required
              minLength={3}
              maxLength={30}
            />
            <small className="field-hint">Your unique username across the platform.</small>
          </label>

          <label className="profile-field">
            <span className="field-label">
              <Mail size={14} /> Email Address
            </span>
            <input
              type="email"
              value={effectiveEmail}
              readOnly
              className="field-readonly"
              title="Email is locked to your account"
            />
            <small className="field-hint">Registered database email address (read-only for security).</small>
          </label>

          <div className="profile-actions-bar">
            <button type="submit" className="primary profile-save-btn" disabled={saving}>
              {saving ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
              <span>{saving ? "Saving..." : "Save Changes"}</span>
            </button>
            <button type="button" className="secondary profile-signout-btn" onClick={onSignOut}>
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({
  close,
  onImportSuccess,
  token,
}: {
  close: () => void;
  onImportSuccess: (doc: LibraryItem, openReader?: boolean) => void;
  token: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("You");
  const [category, setCategory] = useState("Documents");
  const [collectionName, setCollectionName] = useState("Documents");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importWarning, setImportWarning] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [fileContent, setFileContent] = useState("");
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [bookMetadata, setBookMetadata] = useState<BookMetadata | null>(null);
  const [metadataLookupStatus, setMetadataLookupStatus] = useState("");
  const metadataLookupId = useRef(0);
  const titleEdited = useRef(false);
  const authorEdited = useRef(false);
  const titleFromMetadata = useRef(false);
  const authorFromMetadata = useRef(false);

  const buildTextPages = (text: string, fallbackTitle: string): Chapter[] => {
    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (!normalized) return [];

    const blocks = normalized
      .split(/\n\s*\n+/)
      .map((block) => block.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const paragraphs =
      blocks.length > 0 ? blocks : normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
    const pages: Chapter[] = [];

    for (let index = 0; index < paragraphs.length; index += 3) {
      const chunk = paragraphs.slice(index, index + 3);
      const cleanChunk = chunk.filter(Boolean);
      const lead = cleanChunk[0] || "";
      const pageTitle = `Page ${pages.length + 1}`;
      pages.push({
        id: pages.length + 1,
        title: pageTitle,
        subtitle: `${fallbackTitle} · ${pageTitle}`,
        pageStart: pages.length + 1,
        lead,
        paragraphs: cleanChunk.slice(1),
      });
    }

    return pages;
  };

  const handleFiles = async (files: FileList | File | null) => {
    if (!files) return;
    const isSingleFile = files instanceof Blob;
    const fileList: File[] = isSingleFile ? [files as File] : Array.from(files as FileList);
    if (fileList.length === 0) return;
    if (!isSingleFile) {
      setQueuedFiles(fileList);
      setQueueIndex(0);
    }
    const lookupId = ++metadataLookupId.current;
    const file = fileList[0];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const readableExtensions = new Set([
      "pdf",
      "epub",
      "docx",
      "pptx",
      "xlsx",
      "txt",
      "md",
      "markdown",
      "html",
      "htm",
      "csv",
      "json",
      "xml",
      "rtf",
      "py",
      "js",
      "ts",
      "jsx",
      "tsx",
      "css",
      "yaml",
      "yml",
    ]);
    if (!readableExtensions.has(ext)) {
      setSelectedFile(null);
      setMetadataLookupStatus("");
      setError(
        "This file type is not supported. Choose a PDF, ebook, office document, or text file.",
      );
      return;
    }
    titleEdited.current = false;
    authorEdited.current = false;
    titleFromMetadata.current = false;
    authorFromMetadata.current = false;
    setSelectedFile(file);
    setError(null);
    setImportWarning(null);
    setBookMetadata(null);
    setMetadataLookupStatus("Searching book metadata…");

    const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    setCollectionName(detectCollectionName(file, category));
    setTitle(cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1));
    setAuthor("You");
    setPdfPageCount(0);
    setChapters([]);
    setFileContent("");

    const isTextReadable = [
      "txt",
      "md",
      "markdown",
      "html",
      "htm",
      "json",
      "csv",
      "xml",
      "rtf",
      "py",
      "js",
      "ts",
      "jsx",
      "tsx",
      "css",
      "yaml",
      "yml",
    ].includes(ext);

    if (ext === "pdf") {
      setIsProcessing(true);
      try {
        const arrayBuffer = await file.arrayBuffer();

        // Immediate 0ms robust binary page detection
        const binaryInfo = parsePdfBinaryInfo(arrayBuffer);
        const initialCount = Math.max(1, binaryInfo.pageCount);
        setPdfPageCount(initialCount);

        if (binaryInfo.title && !titleEdited.current) {
          setTitle(binaryInfo.title);
          titleFromMetadata.current = true;
        }
        if (binaryInfo.author && !authorEdited.current) {
          setAuthor(binaryInfo.author);
          authorFromMetadata.current = true;
        }

        // Perform parallel deep text & embedded metadata extraction with PDF.js
        const pdfjsLib = await loadPdfJs();
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          useSystemFonts: true,
        });
        const pdf = await loadingTask.promise;
        try {
          const finalCount = pdf.numPages;
          setPdfPageCount(finalCount);

          const deepChapters: Chapter[] = [];
          let combinedText = "";
          let pagesWithoutText = 0;

          for (let p = 1; p <= finalCount; p++) {
            setUploadProgress(Math.round((p / finalCount) * 55));
            const page = await pdf.getPage(p);
            const textContent = await page.getTextContent();
            const items = textContent.items
              .map((item: any) => item.str || "")
              .filter((value: string) => value.trim().length > 0);
            const pageText = items.join(" ");
            if (pageText) combinedText += `\n\n--- Page ${p} ---\n` + pageText;
            else pagesWithoutText++;

            const paragraphs: string[] = [];
            let currentParagraph = "";
            for (const value of items) {
              currentParagraph += (currentParagraph ? " " : "") + value;
              if (
                currentParagraph.length > 180 ||
                value.endsWith(".") ||
                value.endsWith("!") ||
                value.endsWith("?")
              ) {
                paragraphs.push(currentParagraph);
                currentParagraph = "";
              }
            }
            if (currentParagraph) paragraphs.push(currentParagraph);
            deepChapters.push({
              id: p,
              title: `Page ${p} of ${finalCount}`,
              subtitle: `${cleanTitle} · Page ${p}`,
              pageStart: p,
              lead: paragraphs[0] || "No selectable text on this page.",
              paragraphs: paragraphs.slice(1),
            });
          }

          setChapters(deepChapters);
          setFileContent(combinedText);
          if (pagesWithoutText > 0) {
            setImportWarning(
              `${pagesWithoutText} page${pagesWithoutText === 1 ? "" : "s"} has no selectable text. OCR is unavailable; the original PDF can still be viewed.`,
            );
          }

          // Metadata lookup
          try {
            const pdfMetadata = await pdf.getMetadata();
            const info = (pdfMetadata?.info || {}) as { Title?: string; Author?: string };
            const embeddedTitle = info.Title?.trim() || binaryInfo.title;
            const embeddedAuthor = info.Author?.trim() || binaryInfo.author;
            const lookupTitle = embeddedTitle || cleanTitle;
            if (embeddedTitle && !titleEdited.current) {
              setTitle(embeddedTitle);
              titleFromMetadata.current = true;
            }
            if (embeddedAuthor && !authorEdited.current) {
              setAuthor(embeddedAuthor);
              authorFromMetadata.current = true;
            }
            lookupBookMetadata(lookupTitle, embeddedAuthor)
              .then((found) => {
                if (metadataLookupId.current === lookupId && found) {
                  setBookMetadata(found);
                  if (!embeddedTitle && found.title && !titleEdited.current) setTitle(found.title);
                  if (!embeddedAuthor && found.author && !authorEdited.current)
                    setAuthor(found.author);
                  setMetadataLookupStatus("Book metadata found");
                } else if (metadataLookupId.current === lookupId) {
                  setMetadataLookupStatus("Document details ready");
                }
              })
              .catch((metadataError) => {
                console.warn("Book metadata lookup unavailable", metadataError);
                if (metadataLookupId.current === lookupId) {
                  setMetadataLookupStatus("Metadata search unavailable; using file details");
                }
              });
          } catch (metadataError) {
            console.warn("Unable to read PDF metadata", metadataError);
            setMetadataLookupStatus("Document text extracted; metadata unavailable");
          }
        } finally {
          await loadingTask.destroy();
        }
      } catch (err) {
        console.error("PDF read error", err);
        setChapters([]);
        setFileContent("");
        setError(`Could not read PDF: ${err instanceof Error ? err.message : "Check the file."}`);
      } finally {
        setIsProcessing(false);
      }
    } else if (isTextReadable) {
      setIsProcessing(true);
      try {
        let text = await file.text();
        if (ext === "html" || ext === "htm") text = htmlToPlainText(text);
        if (ext === "rtf")
          text = text
            .replace(/\\'[0-9a-f]{2}/gi, " ")
            .replace(/\\[a-z]+-?\d* ?/gi, "")
            .replace(/[{}]/g, "");
        if (!text.trim()) throw new Error("This file contains no readable text.");
        setFileContent(text);
        setChapters(buildTextPages(text, cleanTitle));
      } catch (error) {
        setChapters([]);
        setFileContent("");
        setError(error instanceof Error ? error.message : "Unable to read this text file.");
      } finally {
        setIsProcessing(false);
      }
    } else if (ext === "docx" || ext === "epub") {
      setIsProcessing(true);
      try {
        const text = await extractDocumentText(file, ext.toUpperCase() as ConversionFormat);
        if (!text.trim()) throw new Error("This document contains no readable text.");
        setFileContent(text);
        setChapters(buildTextPages(text, cleanTitle));
      } catch (error) {
        setChapters([]);
        setFileContent("");
        setError(
          error instanceof Error ? error.message : `Unable to read this ${ext.toUpperCase()} file.`,
        );
      } finally {
        setIsProcessing(false);
      }
    } else if (ext === "pptx" || ext === "xlsx") {
      setIsProcessing(true);
      try {
        const text = await extractPresentationText(file, ext.toUpperCase() as "PPTX" | "XLSX");
        if (!text.trim()) throw new Error("This file contains no readable text.");
        setFileContent(text);
        setChapters(buildTextPages(text, cleanTitle));
      } catch (error) {
        setChapters([]);
        setFileContent("");
        setError(
          error instanceof Error ? error.message : `Unable to read this ${ext.toUpperCase()} file.`,
        );
      } finally {
        setIsProcessing(false);
      }
    } else {
      setChapters([]);
      setFileContent("");
      setError("This file type cannot be read in CLIO.");
    }

    if (ext !== "pdf") {
      try {
        const found = await lookupBookMetadata(cleanTitle);
        if (metadataLookupId.current !== lookupId) return;
        if (found) {
          setBookMetadata(found);
          if (found.title && !titleEdited.current) {
            setTitle(found.title);
            titleFromMetadata.current = true;
          }
          if (found.author && !authorEdited.current) {
            setAuthor(found.author);
            authorFromMetadata.current = true;
          }
          setMetadataLookupStatus("Book metadata found");
        } else {
          setMetadataLookupStatus("No matching book metadata found");
        }
      } catch (metadataError) {
        if (metadataLookupId.current === lookupId) {
          console.warn("Book metadata lookup unavailable", metadataError);
          setMetadataLookupStatus("Metadata search unavailable; using file details");
        }
      }
    }
  };

  const handleConfirmImport = async (openInReader: boolean = false) => {
    if (!selectedFile || error) return;
    setIsProcessing(true);
    setError(null);
    setUploadProgress(20);

    try {
      let backendId: string | null = null;
      let backendCreatedAt: string | undefined;

      let backendChapters: Chapter[] | null = null;
      let finalTitle = title || selectedFile.name;
      let finalAuthor = author || "You";
      let backendCollectionId: string | null = null;

      if (token) {
        setUploadProgress(40);
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (titleEdited.current || titleFromMetadata.current) {
          formData.append("title", title || selectedFile.name);
        }
        if (authorEdited.current || authorFromMetadata.current) {
          formData.append("author", author);
        }

        try {
          const uploaded = await apiFetch(
            "/library/upload",
            { method: "POST", body: formData },
            token,
          );
          backendId = uploaded.id || uploaded._id;
          backendCreatedAt = uploaded.created_at;
          if (
            uploaded.chapters &&
            Array.isArray(uploaded.chapters) &&
            uploaded.chapters.length > 0
          ) {
            backendChapters = uploaded.chapters;
          } else if (
            uploaded.metadata?.chapters &&
            Array.isArray(uploaded.metadata.chapters) &&
            uploaded.metadata.chapters.length > 0
          ) {
            backendChapters = uploaded.metadata.chapters;
          }
          if (uploaded.title) finalTitle = uploaded.title;
          if (uploaded.author && uploaded.author !== "Unknown Author")
            finalAuthor = uploaded.author;
          try {
            const collectionResponse = await apiFetch("/collections", {}, token);
            const collections = Array.isArray(collectionResponse)
              ? collectionResponse
              : collectionResponse.collections || [];
            const existing = collections.find(
              (collection: { id?: string; _id?: string; name?: string }) =>
                collection.name?.toLocaleLowerCase() === collectionName.trim().toLocaleLowerCase(),
            );
            const collection =
              existing ||
              (await apiFetch(
                "/collections",
                { method: "POST", body: JSON.stringify({ name: collectionName.trim() }) },
                token,
              ));
            backendCollectionId = collection.id || collection._id || null;
            if (backendCollectionId && backendId) {
              await apiFetch(
                `/collections/${backendCollectionId}/items`,
                { method: "POST", body: JSON.stringify({ library_item_id: backendId }) },
                token,
              );
            }
          } catch (collectionError) {
            setImportWarning(
              `The file was saved, but CLIO could not add it to the detected "${collectionName}" collection: ${
                collectionError instanceof Error
                  ? collectionError.message
                  : "collection sync failed."
              }`,
            );
          }
        } catch (uploadError) {
          setImportWarning(
            `Cloud sync failed, but the file will still be saved locally: ${
              uploadError instanceof Error
                ? uploadError.message
                : "Unable to reach the library service."
            }`,
          );
        }
        setUploadProgress(80);
      } else {
        setUploadProgress(60);
      }

      setUploadProgress(100);

      const resolvedChapters =
        backendChapters && backendChapters.length > 0
          ? backendChapters
          : chapters.length > 0
            ? chapters
            : buildTextPages(fileContent || selectedFile.name, title || selectedFile.name);

      const ext = selectedFile.name.split(".").pop()?.toUpperCase() || "FILE";
      const newDoc: LibraryItem = {
        id: backendId || `local-${Date.now()}`,
        title: finalTitle,
        author: finalAuthor,
        type: ext,
        progress: 0,
        tone: toneForType(ext),
        mark: finalTitle.slice(0, 10).toUpperCase(),
        fileSize: formatBytes(selectedFile.size),
        uploadedAt: "Just now",
        created_at: backendCreatedAt || new Date().toISOString(),
        chapters: resolvedChapters,
        content: fileContent,
        pdfPageCount: pdfPageCount || chapters.length || 1,
        metadata: bookMetadata || undefined,
        collectionName,
      };

      if (isPdfFile(selectedFile.name)) {
        try {
          await saveLocalPdf(newDoc.id, selectedFile);
          if (backendId && backendId !== newDoc.id) {
            await saveLocalPdf(backendId, selectedFile);
          }
        } catch (storageError) {
          console.error("Unable to cache the uploaded PDF locally:", storageError);
          setImportWarning(
            "The file was added to your library, but its offline reader copy could not be cached.",
          );
        }
      }

      await new Promise((r) => setTimeout(r, 300));
      setIsProcessing(false);
      onImportSuccess(newDoc, openInReader);
      if (queueIndex + 1 < queuedFiles.length) {
        const nextIndex = queueIndex + 1;
        setQueueIndex(nextIndex);
        await handleFiles(queuedFiles[nextIndex]);
        return;
      }
      setQueuedFiles([]);
      setQueueIndex(0);
      close();
    } catch (err: any) {
      setError(err.message || "Upload failed. Check that the backend is running.");
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="import-page">
      <div className="external-page-bar">
        <button
          className="brand external-page-brand"
          onClick={close}
          aria-label="Back to CLIO home"
        >
          <b className="brand-word">CLIO</b>
        </button>
      </div>
      <div className="modal import-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">ADD TO CLIO</span>
            <h2>Import files from device</h2>
          </div>
          <button className="import-close-button" onClick={close} aria-label="Close import page">
            <X size={18} />
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          multiple
          accept=".pdf,.epub,.docx,.pptx,.xlsx,.txt,.md,.markdown,.html,.htm,.csv,.json,.xml,.rtf,.py,.js,.ts,.jsx,.tsx,.css,.yaml,.yml"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {!selectedFile ? (
          <>
            <button
              className={`drop-zone modal-drop ${isDragging ? "drag-active" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
            >
              <span>
                <Upload size={22} />
              </span>
              <h3>Drop a supported file from your device here</h3>
              <p>or click to browse your files</p>
              <small>
                Select or drop multiple PDF, EPUB, DOCX, PPTX, XLSX, TXT, Markdown, HTML, CSV, JSON,
                XML, and code/text files
              </small>
            </button>
            {error && (
              <p role="alert" style={{ color: "#ef4444", fontSize: 13, margin: "8px 0 0" }}>
                {error}
              </p>
            )}
          </>
        ) : (
          <div className="metadata-review">
            <div className="preview-doc" style={{ textAlign: "center", padding: "16px 8px" }}>
              <FileText size={32} />
              <span className="file-badge" style={{ marginTop: "8px" }}>
                {selectedFile.name.split(".").pop()?.toUpperCase() || "DOC"}
              </span>
              <small style={{ marginTop: "6px", display: "block", color: "#666" }}>
                {formatBytes(selectedFile.size)}
              </small>
            </div>
            <div>
              <span className="eyebrow">METADATA REVIEW</span>
              {queuedFiles.length > 1 && (
                <p className="import-queue-progress">
                  File {queueIndex + 1} of {queuedFiles.length} · Review each file before adding it
                </p>
              )}
              <label>
                Title
                <input
                  value={title}
                  onChange={(e) => {
                    titleEdited.current = true;
                    setTitle(e.target.value);
                  }}
                />
              </label>
              <label>
                Author
                <input
                  value={author}
                  onChange={(e) => {
                    authorEdited.current = true;
                    setAuthor(e.target.value);
                  }}
                />
              </label>
              <div className="two-fields">
                <label>
                  Category
                  <button
                    type="button"
                    onClick={() => {
                      const nextCategory =
                        category === "Documents"
                          ? "Books"
                          : category === "Books"
                            ? "Presentations"
                            : category === "Presentations"
                              ? "Research"
                              : "Documents";
                      setCategory(nextCategory);
                      const relativePath =
                        (selectedFile as File & { webkitRelativePath?: string })
                          .webkitRelativePath || "";
                      if (!relativePath.includes("/")) setCollectionName(nextCategory);
                    }}
                  >
                    {category} <ChevronDown size={14} />
                  </button>
                </label>
                <label>
                  Collection
                  <button type="button" disabled title="Detected from the file folder or category">
                    <Folder size={14} /> {collectionName}
                  </button>
                </label>
              </div>
              <p style={{ color: "#888", fontSize: 11, margin: "-2px 0 8px" }}>
                Collection detected automatically from the file folder or category.
              </p>
              <label>
                {selectedFile && isPdfFile(selectedFile.name) ? "Pages" : "Chapters"}
                <button type="button" disabled>
                  {selectedFile && isPdfFile(selectedFile.name)
                    ? `${pdfPageCount || chapters.length || 1} pages detected`
                    : `${chapters.length} detected`}
                </button>
              </label>
              {metadataLookupStatus && (
                <p
                  style={{
                    color: metadataLookupStatus === "Book metadata found" ? "#16a34a" : "#888",
                    fontSize: 11,
                    margin: "0 0 8px",
                  }}
                >
                  {metadataLookupStatus}
                  {bookMetadata?.publisher ? ` · ${bookMetadata.publisher}` : ""}
                  {bookMetadata?.publish_year ? ` · ${bookMetadata.publish_year}` : ""}
                </p>
              )}
              {error && (
                <p style={{ color: "#ef4444", fontSize: 13, margin: "8px 0 0" }}>{error}</p>
              )}
              {importWarning && (
                <p role="status" style={{ color: "#b45309", fontSize: 12, margin: "8px 0 0" }}>
                  {importWarning}
                </p>
              )}
              {!token && (
                <p style={{ color: "#f59e0b", fontSize: 12, margin: "8px 0 0" }}>
                  ⚠ Sign in to sync this file to your cloud library. It will be saved locally only.
                </p>
              )}
              {isProcessing && (
                <div className="upload-progress-container">
                  <div className="upload-progress-bar">
                    <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <small style={{ fontSize: "11px", color: "#666" }}>
                    {token ? "Uploading and indexing document..." : "Processing document..."}
                  </small>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ justifyContent: "space-between" }}>
          <button className="secondary" onClick={close}>
            Cancel
          </button>
          {!selectedFile ? (
            <button className="primary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={15} style={{ marginRight: "6px" }} /> Choose from device
            </button>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="secondary"
                onClick={() => handleConfirmImport(false)}
                disabled={isProcessing || !!error}
              >
                {queuedFiles.length > 1 && queueIndex + 1 < queuedFiles.length
                  ? `Add & review next (${queueIndex + 1}/${queuedFiles.length})`
                  : "Add to library"}
              </button>
              <button
                className="primary"
                onClick={() => handleConfirmImport(true)}
                disabled={isProcessing || !!error}
              >
                {isProcessing ? (
                  <Loader2 size={15} className="spin" style={{ marginRight: "6px" }} />
                ) : (
                  <BookOpen size={15} style={{ marginRight: "6px" }} />
                )}
                Read now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Search Overlay ───────────────────────────────────────────────────────────
function SearchOverlay({
  close,
  openReader,
  items,
  go,
  openImport,
}: {
  close: () => void;
  openReader: (book: LibraryItem) => void;
  items: LibraryItem[];
  go: (p: Page) => void;
  openImport: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeResult, setActiveResult] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const results = useMemo(() => {
    if (!normalizedQuery) return [];
    return items
      .map((item) => {
        const title = item.title.toLocaleLowerCase();
        const author = item.author.toLocaleLowerCase();
        const type = item.type.toLocaleLowerCase();
        const documentText = [
          item.content || "",
          ...(item.chapters || []).flatMap((chapter) => [
            chapter.title,
            chapter.lead,
            ...chapter.paragraphs,
          ]),
        ].join("\n");
        const contentIndex = documentText.toLocaleLowerCase().indexOf(normalizedQuery);
        const matches =
          title.includes(normalizedQuery) ||
          author.includes(normalizedQuery) ||
          type.includes(normalizedQuery) ||
          contentIndex >= 0;
        const excerpt =
          contentIndex >= 0
            ? documentText
                .slice(Math.max(0, contentIndex - 55), contentIndex + normalizedQuery.length + 95)
                .replace(/\s+/g, " ")
                .trim()
            : "";
        return { item, matches, excerpt };
      })
      .filter((result) => result.matches)
      .slice(0, 8);
  }, [normalizedQuery, items]);

  useEffect(() => {
    setActiveResult(0);
  }, [normalizedQuery]);

  const openResult = (index: number) => {
    const result = results[index];
    if (result) {
      close();
      openReader(result.item);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      close();
    } else if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setActiveResult((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setActiveResult((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && results.length > 0) {
      event.preventDefault();
      openResult(activeResult);
    }
  };

  return (
    <div className="overlay search-overlay" onMouseDown={close} onClick={close}>
      <div
        className="search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Search your library"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="global-search">
          <Search size={20} />
          <input
            ref={inputRef}
            autoFocus
            aria-label="Search titles, authors, file types, and document text"
            placeholder="Search titles, authors, file types, or document text..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveResult(0);
            }}
            onKeyDown={handleSearchKeyDown}
          />
          {query ? (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              Clear
            </button>
          ) : (
            <kbd>ESC</kbd>
          )}
        </div>
        <div className="search-content">
          {!normalizedQuery ? (
            <>
              <div className="search-label">
                <span>QUICK ACTIONS</span>
                <small>Use ↑↓ to navigate</small>
              </div>
              {[
                [Upload, "Import files", openImport],
                [
                  Sparkles,
                  "Ask your library",
                  () => {
                    close();
                    go("Ask Your Library");
                  },
                ],
                [
                  FolderPlus,
                  "Create a collection",
                  () => {
                    close();
                    go("Collections");
                  },
                ],
              ].map(([Icon, label, action]: any) => (
                <button
                  key={label}
                  onClick={() => {
                    action();
                    close();
                  }}
                >
                  <span>
                    <Icon size={16} />
                  </span>
                  {label}
                </button>
              ))}
              {items.length > 0 && (
                <>
                  <div className="search-label">
                    <span>RECENTLY ADDED</span>
                  </div>
                  {items.slice(0, 4).map((book) => (
                    <button
                      key={book.id}
                      onClick={() => {
                        close();
                        openReader(book);
                      }}
                    >
                      <span>
                        <BookOpen size={16} />
                      </span>
                      <div>
                        <b>{book.title}</b>
                        <small>
                          {book.author} · {book.type}
                          {book.progress > 0 ? ` · ${book.progress}% read` : ""}
                        </small>
                      </div>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </>
              )}
            </>
          ) : results.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "#888", fontSize: 14 }}>
              No library items found for “{query.trim()}”.
            </div>
          ) : (
            <>
              <div className="search-label">
                <span>RESULTS ({results.length})</span>
                <small>Use ↑↓ and Enter</small>
              </div>
              {results.map(({ item, excerpt }, index) => (
                <button
                  key={item.id}
                  className={index === activeResult ? "is-active" : ""}
                  aria-selected={index === activeResult}
                  onMouseEnter={() => setActiveResult(index)}
                  onClick={() => openResult(index)}
                >
                  <span>
                    <BookOpen size={16} />
                  </span>
                  <div>
                    <b>{item.title}</b>
                    <small>{excerpt || `${item.author} · ${item.type}`}</small>
                  </div>
                  <ArrowRight size={14} />
                </button>
              ))}
            </>
          )}
        </div>
        <footer>
          <span>
            <kbd>↵</kbd> Open
          </span>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Navigate
          </span>
          <span>CLIO Search</span>
        </footer>
      </div>
    </div>
  );
}

// ─── Nav groups ───────────────────────────────────────────────────────────────
const navGroups: { label: string; items: { name: Page; icon: any }[] }[] = [
  {
    label: "Workspace",
    items: [
      { name: "Overview", icon: Home },
      { name: "My Library", icon: Library },
      { name: "Collections", icon: Folder },
    ],
  },
  {
    label: "Reading",
    items: [
      { name: "Discover Books", icon: Search },
      { name: "Ask Your Library", icon: Sparkles },
      { name: "Study Workspace", icon: BrainCircuit },
    ],
  },
  {
    label: "Tools",
    items: [
      { name: "File Converter", icon: ArrowLeftRight },
      { name: "Downloaded Files", icon: Download },
    ],
  },
];

const secondaryNavItems: { name: Page; icon: any }[] = [
  { name: "Books", icon: BookOpen },
  { name: "Documents", icon: FileText },
  { name: "Presentations", icon: FileChartColumn },
  { name: "Knowledge Graph", icon: Network },
  { name: "Highlights", icon: Highlighter },
  { name: "Reading Memory", icon: BookMarked },
  { name: "PDF Toolkit", icon: FileArchive },
  { name: "Reading Dashboard", icon: BarChart3 },
];

// ─── Root App ─────────────────────────────────────────────────────────────────
function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem("clio_theme") !== "light";
    } catch (error) {
      console.warn("Unable to read saved appearance preference:", error);
      return true;
    }
  });
  const [page, setPage] = useState<Page>("Overview");
  const [drawer, setDrawer] = useState(false);
  const [moreNavOpen, setMoreNavOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reader, setReader] = useState(false);
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    try {
      localStorage.setItem("clio_theme", isDarkMode ? "dark" : "light");
    } catch (error) {
      console.error("Unable to save appearance preference:", error);
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

    const root = document.documentElement;
    const appRoot = document.getElementById("root");
    let animationFrame = 0;
    let lastColor = "";

    const updateSystemBars = () => {
      animationFrame = 0;
      const surface = document.querySelector<HTMLElement>(".splash, .reader, .app");
      const background = surface ? getComputedStyle(surface).backgroundColor : "rgb(255, 255, 255)";
      const parsedChannels = background.match(/[\d.]+/g)?.map(Number);
      const channels: [number, number, number, number] =
        parsedChannels && parsedChannels.length >= 3
          ? [
              parsedChannels[0] ?? 255,
              parsedChannels[1] ?? 255,
              parsedChannels[2] ?? 255,
              parsedChannels[3] ?? 1,
            ]
          : [255, 255, 255, 1];
      const [red, green, blue, alpha] = channels;
      const composite = (channel: number) => Math.round(channel * alpha + 255 * (1 - alpha));
      const color = `#${[red, green, blue]
        .map(composite)
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("")}`;

      if (!root.classList.contains("android-edge-to-edge")) {
        root.classList.add("android-edge-to-edge");
      }
      if (root.style.getPropertyValue("--system-surface-color") !== color) {
        root.style.setProperty("--system-surface-color", color);
      }
      if (root.style.backgroundColor !== color) root.style.backgroundColor = color;
      if (document.body.style.backgroundColor !== color) {
        document.body.style.backgroundColor = color;
      }
      if (appRoot && appRoot.style.backgroundColor !== color) {
        appRoot.style.backgroundColor = color;
      }

      if (color === lastColor) return;
      lastColor = color;
      SystemBarAppearance.setColor({ color }).catch((error: unknown) => {
        console.error("Unable to update Android system bar appearance", error);
      });
    };

    const scheduleUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateSystemBars);
    };
    const observer = new MutationObserver(scheduleUpdate);

    updateSystemBars();
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "style"],
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      root.classList.remove("android-edge-to-edge");
      root.style.removeProperty("--system-surface-color");
      root.style.removeProperty("background-color");
      document.body.style.removeProperty("background-color");
      appRoot?.style.removeProperty("background-color");
    };
  }, []);

  // Auth state
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("clio_token"));
  const [user, setUser] = useState<User | null>(() => {
    try {
      const u = localStorage.getItem("clio_user");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });
  const [showAuth, setShowAuth] = useState(false);

  // Library state — always from backend when authed, localStorage fallback
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [activeBook, setActiveBook] = useState<LibraryItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState(() =>
    navigator.onLine ? "Device ready" : "Offline",
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(() => readPendingSyncActions().length);

  // Toast
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Fetch library from backend
  const fetchLibrary = useCallback(async (tok: string | null) => {
    if (!tok) {
      // Load from localStorage if no token
      try {
        const saved = localStorage.getItem("clio_local_library");
        if (saved) {
          const parsed = JSON.parse(saved);
          setItems(Array.isArray(parsed) ? parsed : []);
        }
      } catch {}
      return;
    }
    setLoadingItems(true);
    try {
      const data = await apiFetch("/library", {}, tok);
      const fetched: LibraryItem[] = (Array.isArray(data) ? data : data.items || []).map(
        (item: any) => ({
          id: item.id || item._id,
          title: item.title || "Untitled",
          author: item.author || "Unknown",
          type: (item.file_type || item.type || "FILE").toUpperCase(),
          progress: item.reading_progress ?? item.progress ?? 0,
          tone: toneForType(item.file_type || item.type || ""),
          mark: (item.title || "DOC").slice(0, 10).toUpperCase(),
          fileSize: item.file_size ? formatBytes(item.file_size) : item.fileSize,
          uploadedAt: formatRelative(item.created_at),
          created_at: item.created_at,
          chapters: item.chapters || item.metadata?.chapters || [],
          content: item.content || "",
          metadata: item.metadata || undefined,
          pdfPageCount: item.page_count,
          is_favourite: item.is_favourite || false,
          tags: Array.isArray(item.tags) ? item.tags : [],
          language: item.language || "en",
        }),
      );
      let localItems: LibraryItem[] = [];
      try {
        const saved = localStorage.getItem("clio_local_library");
        const parsed = saved ? JSON.parse(saved) : [];
        localItems = Array.isArray(parsed)
          ? parsed.filter(
              (item: LibraryItem) => typeof item?.id === "string" && item.id.startsWith("local-"),
            )
          : [];
      } catch (error) {
        console.warn("Unable to restore locally saved library items:", error);
      }
      const fetchedIds = new Set(fetched.map((item) => item.id));
      setItems([...localItems.filter((item) => !fetchedIds.has(item.id)), ...fetched]);
    } catch {
      // Fallback to localStorage
      try {
        const saved = localStorage.getItem("clio_local_library");
        if (saved) setItems(JSON.parse(saved));
      } catch {}
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    fetchLibrary(token);
  }, [token, fetchLibrary]);

  useEffect(() => {
    let active = true;
    const synchronizePendingChanges = async () => {
      if (!navigator.onLine) {
        setSyncStatus("Offline");
        setPendingSyncCount(readPendingSyncActions().length);
        return;
      }
      if (!token || token.startsWith("local-token-")) {
        setSyncStatus("Device only");
        return;
      }
      if (localStorage.getItem("clio_auto_sync") === "false") {
        setSyncStatus("Sync paused");
        return;
      }
      const actions = readPendingSyncActions();
      setPendingSyncCount(actions.length);
      if (!actions.length) {
        setSyncStatus("Synced");
        return;
      }
      setSyncStatus("Syncing…");
      const remaining: PendingSyncAction[] = [];
      let completed = 0;
      for (const action of actions) {
        try {
          await apiFetch(action.path, { method: action.method, body: action.body }, token);
          completed += 1;
          if (action.localNoteId) {
            try {
              const noteKey = `clio_local_notes_${action.itemId}`;
              const localNotes = JSON.parse(localStorage.getItem(noteKey) || "[]");
              localStorage.setItem(
                noteKey,
                JSON.stringify(
                  (Array.isArray(localNotes) ? localNotes : []).filter(
                    (note: Note) => note.id !== action.localNoteId,
                  ),
                ),
              );
            } catch (error) {
              console.error("Synced note, but could not clean up its local queued copy:", error);
            }
          }
        } catch (error) {
          console.warn(`Offline change remains queued (${action.path}):`, error);
          remaining.push(action);
        }
      }
      try {
        savePendingSyncActions(remaining);
      } catch {
        if (active) setSyncStatus("Sync needs attention");
        return;
      }
      if (!active) return;
      setPendingSyncCount(remaining.length);
      setSyncStatus(
        remaining.length
          ? `${remaining.length} change${remaining.length === 1 ? "" : "s"} pending`
          : "Synced",
      );
      if (completed) window.dispatchEvent(new Event("clio-sync-complete"));
    };

    const handleOnline = () => {
      void synchronizePendingChanges();
    };
    const handleQueued = () => {
      setPendingSyncCount(readPendingSyncActions().length);
      if (navigator.onLine) void synchronizePendingChanges();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("clio-sync-queued", handleQueued);
    void synchronizePendingChanges();
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("clio-sync-queued", handleQueued);
    };
  }, [token]);

  // Auth handlers
  const handleAuth = (tok: string, u: User) => {
    setToken(tok);
    setUser(u);
    localStorage.setItem("clio_token", tok);
    localStorage.setItem("clio_user", JSON.stringify(u));
    setShowAuth(false);
    showToast(`✓ Signed in as ${u.full_name || u.email}`);
    fetchLibrary(tok);
  };

  const persistLocalLibrary = useCallback((nextItems: LibraryItem[]) => {
    try {
      localStorage.setItem("clio_local_library", JSON.stringify(nextItems));
    } catch (error) {
      console.error("Unable to persist the local library:", error);
    }
  }, []);

  const handleSignOut = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("clio_token");
    localStorage.removeItem("clio_user");
    localStorage.removeItem("clio_local_library");
    setItems([]);
    showToast("Signed out");
  };

  // Import handler
  const handleImportSuccess = useCallback(
    (newDoc: LibraryItem, openNow: boolean = false) => {
      setItems((prev) => {
        const updated = [newDoc, ...prev];
        persistLocalLibrary(updated);
        return updated;
      });
      showToast(`✓ Imported "${newDoc.title}"`);
      if (openNow) {
        setActiveBook(newDoc);
        setReader(true);
      }
    },
    [persistLocalLibrary, showToast],
  );

  const handleDeleteItem = useCallback(
    async (id: string) => {
      if (items.some((item) => item.id === id && item.type.toLowerCase() === "pdf")) {
        removeLocalPdf(id).catch((error) => console.error("Unable to remove cached PDF", error));
      }
      try {
        localStorage.removeItem(`clio_bookmarks_${id}`);
      } catch (error) {
        console.error("Unable to remove saved bookmarks for deleted item", error);
      }
      setItems((prev) => {
        const updated = prev.filter((i) => i.id !== id);
        persistLocalLibrary(updated);
        return updated;
      });
      if (token && !id.startsWith("local-")) {
        apiFetch(`/library/${id}`, { method: "DELETE" }, token).catch(() => {});
      }
      showToast("Item deleted");
    },
    [items, persistLocalLibrary, token, showToast],
  );

  const openReaderWithDoc = useCallback((doc?: LibraryItem) => {
    setActiveBook(doc || null);
    setReader(true);
  }, []);

  const handleConversionComplete = useCallback(
    async (file: File, text: string, title: string) => {
      const chapters = buildDownloadedTextChapters(text, title);
      if (chapters.length === 0) {
        throw new Error("The converted file contains no readable text.");
      }

      let backendId: string | null = null;
      let backendCreatedAt: string | undefined;
      let finalTitle = title || file.name;
      let finalAuthor = "Converted by CLIO";

      if (token) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", finalTitle);
        formData.append("author", finalAuthor);
        const uploaded = await apiFetch(
          "/library/upload",
          { method: "POST", body: formData },
          token,
        );
        backendId = uploaded.id || uploaded._id || null;
        backendCreatedAt = uploaded.created_at;
        if (uploaded.title) finalTitle = uploaded.title;
        if (uploaded.author && uploaded.author !== "Unknown Author") finalAuthor = uploaded.author;
      }

      const extension = file.name.split(".").pop()?.toUpperCase() || "FILE";
      const newDoc: LibraryItem = {
        id: backendId || `local-${Date.now()}`,
        title: finalTitle,
        author: finalAuthor,
        type: extension,
        progress: 0,
        tone: toneForType(extension),
        mark: finalTitle.slice(0, 10).toUpperCase(),
        fileSize: formatBytes(file.size),
        uploadedAt: "Just now",
        created_at: backendCreatedAt || new Date().toISOString(),
        chapters,
        content: text,
      };

      if (extension === "PDF") {
        await saveLocalPdf(newDoc.id, file);
      }

      setItems((previous) => {
        const updated = [newDoc, ...previous.filter((item) => item.id !== newDoc.id)];
        persistLocalLibrary(updated);
        return updated;
      });
      setActiveBook(newDoc);
      setReader(true);
      showToast(`✓ Saved "${finalTitle}" to your library`);
    },
    [persistLocalLibrary, showToast, token],
  );

  const viewDownloadedFile = useCallback(async (file: DownloadedFile) => {
    const blob = await getDownloadedFileBlob(file);
    const extension = file.name.split(".").pop()?.toUpperCase() || "";
    const title = file.name.replace(/\.[^/.]+$/, "");
    const id = `downloaded-${file.id}`;
    if (extension === "PDF") {
      await saveLocalPdf(id, new globalThis.File([blob], file.name, { type: "application/pdf" }));
      setActiveBook({
        id,
        title,
        author: "Converted by CLIO",
        type: "PDF",
        progress: 0,
        tone: toneForType("PDF"),
        mark: title.slice(0, 10).toUpperCase(),
        fileSize: formatBytes(file.size),
        uploadedAt: new Date(file.modifiedAt).toISOString(),
        chapters: [],
        content: "",
      });
    } else {
      const format = extension === "HTM" ? "HTML" : extension === "MARKDOWN" ? "MD" : extension;
      if (!["DOCX", "EPUB", "TXT", "MD", "HTML"].includes(format)) {
        throw new Error(`CLIO cannot preview .${extension.toLowerCase()} files.`);
      }
      const textFile = new globalThis.File([blob], file.name, { type: file.mimeType });
      const text = await extractDocumentText(textFile, format as ConversionFormat);
      const chapters = buildDownloadedTextChapters(text, title);
      if (!chapters.length) throw new Error("This downloaded file contains no readable text.");
      setActiveBook({
        id,
        title,
        author: "Converted by CLIO",
        type: extension,
        progress: 0,
        tone: toneForType(extension),
        mark: title.slice(0, 10).toUpperCase(),
        fileSize: formatBytes(file.size),
        uploadedAt: new Date(file.modifiedAt).toISOString(),
        chapters,
        content: text,
      });
    }
    setReader(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const timer = window.setTimeout(() => setSplash(false), 2150);
    const keys = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key === "Escape") {
        setDrawer(false);
        setSearch(false);
        setImporting(false);
        setShowAuth(false);
      }
    };
    window.addEventListener("keydown", keys);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", keys);
    };
  }, []);

  const go = useCallback((p: Page) => {
    setPage(p);
    setDrawer(false);
    setMoreNavOpen(false);
  }, []);

  const content = useMemo(() => {
    if (page === "Overview")
      return (
        <Dashboard
          go={go}
          openSearch={() => setSearch(true)}
          openImport={() => setImporting(true)}
          openReader={openReaderWithDoc}
          items={items}
          user={user}
          loadingItems={loadingItems}
        />
      );
    if (
      page === "My Library" ||
      page === "Books" ||
      page === "Documents" ||
      page === "Presentations"
    )
      return (
        <LibraryPage
          openReader={openReaderWithDoc}
          openImport={() => setImporting(true)}
          items={items}
          token={token}
          loadingItems={loadingItems}
          onDelete={handleDeleteItem}
        />
      );
    if (page === "Discover Books") return <OpenLibraryPage />;
    if (page === "Ask Your Library")
      return <AskPage token={token} items={items} onAuthRequired={() => setShowAuth(true)} />;
    if (page === "File Converter") {
      return (
        <ConverterPage
          onShowDownloads={() => go("Downloaded Files")}
          onConversionComplete={handleConversionComplete}
        />
      );
    }
    if (page === "Downloaded Files") return <DownloadedFilesPage onViewFile={viewDownloadedFile} />;
    if (page === "Reading Analytics" || page === "Reading Dashboard")
      return (
        <ReadingDashboardPage items={items} token={token} onSignIn={() => setShowAuth(true)} />
      );
    if (page === "Settings")
      return (
        <SettingsPage
          user={user}
          token={token}
          onSignOut={handleSignOut}
          onSignIn={() => setShowAuth(true)}
        />
      );
    if (page === "Profile")
      return (
        <ProfilePage
          token={token}
          user={user}
          onUserUpdate={(u) => {
            setUser(u);
            localStorage.setItem("clio_user", JSON.stringify(u));
          }}
          onSignIn={() => setShowAuth(true)}
          onSignOut={handleSignOut}
        />
      );
    if (page === "Help and Support")
      return <HelpPage go={go} openImport={() => setImporting(true)} />;
    if (page === "Collections")
      return (
        <CollectionsPage
          items={items}
          token={token}
          onSignIn={() => setShowAuth(true)}
          openReader={openReaderWithDoc}
        />
      );
    if (page === "Study Workspace")
      return <StudyPage items={items} token={token} onSignIn={() => setShowAuth(true)} />;
    if (page === "Highlights" || page === "Reading Memory")
      return <HighlightsPage items={items} token={token} onSignIn={() => setShowAuth(true)} />;
    if (page === "Knowledge Graph")
      return <KnowledgeGraphPage items={items} token={token} onSignIn={() => setShowAuth(true)} />;
    if (page === "PDF Toolkit")
      return <PdfToolkitPage items={items} token={token} onOpenReader={openReaderWithDoc} />;
    return (
      <Dashboard
        go={go}
        openSearch={() => setSearch(true)}
        openImport={() => setImporting(true)}
        openReader={openReaderWithDoc}
        items={items}
        user={user}
        loadingItems={loadingItems}
      />
    );
  }, [
    page,
    items,
    token,
    user,
    loadingItems,
    go,
    openReaderWithDoc,
    handleDeleteItem,
    handleConversionComplete,
    viewDownloadedFile,
  ]);

  // ─ Splash ──────────────────────────────────────────────────────────────────
  if (splash)
    return (
      <div className="splash">
        <div className="splash-word" aria-label="CLIO">
          {["C", "L", "I", "O"].map((letter, index) => (
            <span key={letter} style={{ "--letter-index": index } as React.CSSProperties}>
              {letter}
            </span>
          ))}
        </div>
        <span className="loader" />
      </div>
    );

  // ─ Reader mode ─────────────────────────────────────────────────────────────
  if (reader && activeBook)
    return <Reader close={() => setReader(false)} book={activeBook} token={token} />;

  // ─ Main shell ──────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => go("Overview")}>
          <b className="brand-word">CLIO</b>
        </button>
        {page !== "Overview" && (
          <button
            className="icon-btn back-btn"
            onClick={() => go("Overview")}
            aria-label="Back to home"
            title="Back to home"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <button
          className="header-search"
          onClick={() => setSearch(true)}
          aria-label="Search your library"
        >
          <Search size={16} />
          <span>Search your library...</span>
          <kbd>
            <Command size={11} /> K
          </kbd>
        </button>
        <div className="top-actions">
          <button
            className={`sync${syncStatus === "Offline" ? " sync-offline" : ""}`}
            onClick={() => {
              void fetchLibrary(token);
              if (navigator.onLine) window.dispatchEvent(new Event("online"));
            }}
            title={`Refresh library · ${pendingSyncCount} changes pending`}
          >
            <span /> {syncStatus}
          </button>
          <button
            className="icon-btn theme-toggle"
            onClick={() => setIsDarkMode((dark) => !dark)}
            aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
            title={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
            aria-pressed={isDarkMode}
          >
            {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            className="icon-btn search-mobile-btn"
            onClick={() => setSearch(true)}
            aria-label="Search library"
            title="Search library"
          >
            <Search size={18} />
          </button>
          <button
            className="icon-btn notification"
            aria-label="Notifications"
            onClick={() => showToast("🔔 All documents and intelligence systems are up to date.")}
            title="Notifications"
          >
            <Bell size={17} />
            <i />
          </button>
          {user ? (
            <button
              className="avatar"
              title={`${user.full_name || user.email} — Profile & Account`}
              onClick={() => go("Profile")}
              style={{ overflow: "hidden", padding: 0 }}
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name || user.email}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                initials(user.full_name || user.email)
              )}
            </button>
          ) : (
            <button
              className="sign-in-button"
              title="Sign in"
              aria-label="Sign in"
              onClick={() => setShowAuth(true)}
            >
              <LogIn size={14} />
              <span>Sign in</span>
            </button>
          )}
          <button
            className={`icon-btn menu-btn ${drawer ? "active" : ""}`}
            onClick={() => setDrawer(!drawer)}
            aria-label={drawer ? "Close menu" : "Open menu"}
            aria-expanded={drawer}
            aria-controls="workspace-navigation"
          >
            {drawer ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {content}

      <button
        className="floating-ai-button"
        onClick={() => go("Ask Your Library")}
        aria-label="Open Ask AI"
        title="Ask AI about your library"
      >
        <Sparkles size={22} />
        <span>AI</span>
      </button>

      {/* Bottom navigation bar removed in favor of top hamburger drawer */}

      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(false)} role="presentation">
          <aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace navigation"
            id="workspace-navigation"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-head">
              <div className="drawer-brand">
                <span>
                  <b className="brand-word">CLIO</b>
                  <small>Your workspace</small>
                </span>
              </div>
              <button
                className="icon-btn drawer-close"
                onClick={() => setDrawer(false)}
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>
            <div className="drawer-body">
              {navGroups.map((group) => (
                <nav key={group.label} aria-label={group.label}>
                  <span>{group.label}</span>
                  {group.items.map((item) => (
                    <button
                      className={page === item.name ? "active" : ""}
                      onClick={() => go(item.name)}
                      key={item.name}
                      aria-current={page === item.name ? "page" : undefined}
                    >
                      <item.icon size={17} />
                      {item.name}
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </nav>
              ))}
              <nav aria-label="More workspace areas" className="drawer-more-nav">
                <button
                  className={
                    moreNavOpen || secondaryNavItems.some((item) => item.name === page)
                      ? "active"
                      : ""
                  }
                  onClick={() => setMoreNavOpen((open) => !open)}
                  aria-expanded={moreNavOpen}
                >
                  <MoreHorizontal size={17} />
                  More workspace areas
                  <ChevronDown size={14} className={moreNavOpen ? "drawer-chevron-open" : ""} />
                </button>
                {moreNavOpen &&
                  secondaryNavItems.map((item) => (
                    <button
                      className={page === item.name ? "active" : ""}
                      onClick={() => go(item.name)}
                      key={item.name}
                      aria-current={page === item.name ? "page" : undefined}
                    >
                      <item.icon size={17} />
                      {item.name}
                      <ChevronRight size={14} />
                    </button>
                  ))}
              </nav>
            </div>
            <div className="drawer-footer">
              <span className="drawer-footer-label">Preferences & account</span>
              <button
                className={page === "Profile" ? "active" : ""}
                onClick={() => go("Profile")}
                aria-current={page === "Profile" ? "page" : undefined}
              >
                <User size={17} />
                Profile
              </button>
              <button
                className={page === "Settings" ? "active" : ""}
                onClick={() => go("Settings")}
                aria-current={page === "Settings" ? "page" : undefined}
              >
                <Settings size={17} />
                Settings
              </button>
              <button
                className={page === "Help and Support" ? "active" : ""}
                onClick={() => go("Help and Support")}
                aria-current={page === "Help and Support" ? "page" : undefined}
              >
                <CircleHelp size={17} />
                Help and Support
              </button>
              <div className="profile" onClick={() => { go("Profile"); setDrawer(false); }} style={{ cursor: "pointer" }}>
                <span style={{ overflow: "hidden" }}>
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name || user.email}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : user ? (
                    initials(user.full_name || user.email)
                  ) : (
                    "?"
                  )}
                </span>
                <div>
                  <b>{user?.full_name || (token ? user?.email : "Guest")}</b>
                  <small>{user?.username ? `@${user.username}` : user ? "Personal workspace" : "Sign in to sync"}</small>
                </div>
                {user ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSignOut();
                    }}
                    title="Sign out"
                    aria-label="Sign out"
                  >
                    <LogOut size={16} />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAuth(true);
                    }}
                    title="Sign in"
                    aria-label="Sign in"
                  >
                    <LogIn size={16} />
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {search && (
        <SearchOverlay
          close={() => setSearch(false)}
          openReader={(book) => {
            setSearch(false);
            openReaderWithDoc(book);
          }}
          items={items}
          go={(p) => {
            setSearch(false);
            go(p);
          }}
          openImport={() => {
            setSearch(false);
            setImporting(true);
          }}
        />
      )}

      {importing && (
        <ImportModal
          close={() => setImporting(false)}
          onImportSuccess={handleImportSuccess}
          token={token}
        />
      )}

      {showAuth && <AuthModal onAuth={handleAuth} close={() => setShowAuth(false)} />}

      {toastMessage && (
        <div className="clio-toast">
          <Check size={16} color="#4ade80" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default App;
