import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCw, Search, ZoomIn, ZoomOut } from "lucide-react";
import type * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

interface LocalPdfJsViewerProps {
  file: File;
}

interface SearchMatch {
  page: number;
  count: number;
}

export function LocalPdfJsViewer({ file }: LocalPdfJsViewerProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [activeMatch, setActiveMatch] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [renderError, setRenderError] = useState("");
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | undefined;
    setPdf(null);
    setError("");
    setRenderError("");
    setMatches([]);
    setPageNumber(1);
    setZoom(1);
    setRotation(0);

    const loadPdf = async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      loadingTask = pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        useSystemFonts: true,
      });
      const document = await loadingTask.promise;
      if (cancelled) {
        await loadingTask.destroy();
        return;
      }
      setPdf(document);
    };

    loadPdf().catch((cause: unknown) => {
      if (!cancelled) {
        setError(cause instanceof Error ? cause.message : "Could not open this PDF.");
      }
    });

    return () => {
      cancelled = true;
      void loadingTask?.destroy().catch(() => {});
    };
  }, [file]);

  useEffect(() => {
    if (!pdf || !canvas) return;
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | undefined;

    const renderPage = async () => {
      setRenderError("");
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: zoom, rotation });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not initialize the PDF canvas.");
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      });
      await renderTask.promise;
    };

    renderPage().catch((cause: unknown) => {
      if (!cancelled && !(cause instanceof Error && cause.name === "RenderingCancelledException")) {
        setRenderError(cause instanceof Error ? cause.message : "Could not render this PDF page.");
      }
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [canvas, pageNumber, pdf, rotation, zoom]);

  const searchPdf = async () => {
    if (!pdf) return;
    const term = query.trim().toLocaleLowerCase();
    if (!term) {
      setMatches([]);
      setRenderError("Enter text to search this PDF.");
      return;
    }

    setIsSearching(true);
    setRenderError("");
    try {
      const results: SearchMatch[] = [];
      for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
        const page = await pdf.getPage(pageIndex);
        const content = await page.getTextContent();
        const pageText = content.items
          .filter((item): item is TextItem => "str" in item)
          .map((item) => item.str)
          .join(" ")
          .toLocaleLowerCase();
        let count = 0;
        let offset = 0;
        while ((offset = pageText.indexOf(term, offset)) !== -1) {
          count += 1;
          offset += term.length;
        }
        if (count) results.push({ page: pageIndex, count });
      }
      setMatches(results);
      setActiveMatch(0);
      if (results.length) setPageNumber(results[0].page);
      else setRenderError(`No matches found for "${query.trim()}".`);
    } catch (cause) {
      setRenderError(cause instanceof Error ? cause.message : "Could not search this PDF.");
    } finally {
      setIsSearching(false);
    }
  };

  const goToMatch = (matchIndex: number) => {
    if (!matches.length) return;
    const wrappedIndex = (matchIndex + matches.length) % matches.length;
    setActiveMatch(wrappedIndex);
    setPageNumber(matches[wrappedIndex].page);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 bg-neutral-950 p-3">
        <button
          type="button"
          onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
          disabled={!pdf || pageNumber <= 1}
          aria-label="Previous PDF page"
          className="rounded-lg border border-neutral-700 p-2 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-neutral-300" aria-live="polite">
          Page {pdf ? pageNumber : "-"} of {pdf?.numPages ?? "-"}
        </span>
        <button
          type="button"
          onClick={() =>
            setPageNumber((current) => Math.min(pdf?.numPages ?? current, current + 1))
          }
          disabled={!pdf || pageNumber >= pdf.numPages}
          aria-label="Next PDF page"
          className="rounded-lg border border-neutral-700 p-2 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((current) => Math.max(0.5, Number((current - 0.25).toFixed(2))))}
          disabled={!pdf || zoom <= 0.5}
          aria-label="Zoom out"
          className="rounded-lg border border-neutral-700 p-2 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="min-w-10 text-center text-xs text-neutral-400">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((current) => Math.min(2.5, Number((current + 0.25).toFixed(2))))}
          disabled={!pdf || zoom >= 2.5}
          aria-label="Zoom in"
          className="rounded-lg border border-neutral-700 p-2 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setRotation((current) => (current + 90) % 360)}
          disabled={!pdf}
          aria-label="Rotate PDF page"
          className="rounded-lg border border-neutral-700 p-2 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <form
          className="flex min-w-48 flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void searchPdf();
          }}
        >
          <label className="sr-only" htmlFor="pdf-search">
            Search PDF text
          </label>
          <input
            id="pdf-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={200}
            placeholder="Search PDF text"
            className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-100 placeholder:text-neutral-500"
          />
          <button
            type="submit"
            disabled={!pdf || isSearching}
            aria-label="Search PDF"
            className="rounded-lg border border-neutral-700 p-2 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>
        {matches.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-neutral-400" aria-live="polite">
            <span>
              {activeMatch + 1}/{matches.length} pages ·{" "}
              {matches.reduce((total, match) => total + match.count, 0)} matches
            </span>
            <button
              type="button"
              onClick={() => goToMatch(activeMatch - 1)}
              aria-label="Previous search result"
              className="rounded p-1 hover:bg-neutral-800"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => goToMatch(activeMatch + 1)}
              aria-label="Next search result"
              className="rounded p-1 hover:bg-neutral-800"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {renderError && (
        <p role="status" className="border-b border-neutral-800 px-3 py-2 text-xs text-neutral-300">
          {renderError}
        </p>
      )}
      <div className="grid min-h-[400px] flex-1 place-items-start justify-center overflow-auto bg-neutral-800 p-4">
        {error ? (
          <p role="alert" className="text-sm text-neutral-200">
            {error}
          </p>
        ) : !pdf ? (
          <p className="text-sm text-neutral-300">Loading PDF.js preview…</p>
        ) : (
          <canvas
            ref={setCanvas}
            aria-label={`PDF page ${pageNumber}`}
            className="bg-white shadow-xl"
          />
        )}
      </div>
    </div>
  );
}
