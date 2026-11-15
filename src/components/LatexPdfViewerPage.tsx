import React, { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  Download,
  FileCode2,
  FilePlus2,
  FileUp,
  Save,
  Trash2,
  Eye,
  Code2,
  Copy,
  Check,
  Split,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  UserCheck,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { FeatureApiFetch, getErrorMessage, hasCloudSession } from "./featureApi";
import { LocalPdfJsViewer } from "./LocalPdfJsViewer";

interface LatexPdfContent {
  title: string;
  author: string;
  abstract: string;
  sections: string[];
  equations: string[];
  references: string[];
  paragraphs: string[];
}

interface ManuscriptSummary {
  id: string;
  title: string;
  updated_at: string;
}

interface UserInfo {
  id: string;
  email: string;
  full_name?: string;
  username?: string;
}

interface LatexPdfViewerPageProps {
  token?: string | null;
  user?: UserInfo | null;
  apiFetch?: FeatureApiFetch;
  onSignIn?: () => void;
  onSaveDownload?: (blob: Blob, fileName: string) => Promise<void>;
}

const SAMPLE_LATEX = `\\documentclass[11pt,a4paper]{article}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{geometry}
\\geometry{margin=1in}

\\title{\\textbf{Deep Neural Architectures for Multimodal Document Analysis}}
\\author{\\textbf{CLIO Research Lab} \\\\ \\small Academic Platform \\\\ \\small \\texttt{research@clio.platform}}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
Multimodal document comprehension requires joint modeling of text, layout geometry, and mathematical syntax. In this work, we present a unified framework for real-time document parsing with verified citation indexing and automated LaTeX formula reconstruction.
\\end{abstract}

\\section{Introduction}
Document processing platforms have evolved beyond raw text OCR to structure-aware layout parsing \\cite{vaswani2017attention}. High-performance scholarly platforms must support both mathematical representation and reference integrity checking.

\\section{Mathematical Formulation}
The multimodal objective function $L(\\theta)$ is formulated as:

\\begin{equation}
L(\\theta) = - \\sum_{i=1}^N \\log P(y_i \\mid x_i; \\theta) + \\lambda \\left\\| \\mathbf{W} \\right\\|_2^2
\\end{equation}

Where the attention weights across document tokens are computed via:

\\begin{equation}
\\text{Attention}(Q, K, V) = \\text{softmax}\\left( \\frac{Q K^T}{\\sqrt{d_k}} \\right) V
\\end{equation}

\\section{Experimental Results}
Our evaluation on benchmark academic datasets demonstrates superior recall on LaTeX mathematical expressions and zero-shot reference hallucination detection.

\\begin{thebibliography}{99}
\\bibitem{vaswani2017attention} Vaswani, A., et al. (2017). Attention is all you need. \\textit{NeurIPS 2017}.
\\end{thebibliography}

\\end{document}
`;

const NEW_LATEX_TEMPLATE = `\\documentclass{article}
\\usepackage[margin=1in]{geometry}

\\title{Untitled Manuscript}
\\author{}
\\date{\\today}

\\begin{document}
\\maketitle

\\end{document}
`;

function getManuscriptPdfFilename(title: string) {
  const baseName = (title.replace(/\.(tex|pdf)$/i, "").trim() || "manuscript")
    .replace(/[\\/:*?"<>|]/g, "-");
  return `${baseName}.pdf`;
}

function parseLatexInRealtime(tex: string): LatexPdfContent {
  if (!tex || !tex.trim()) {
    return {
      title: "Untitled Manuscript",
      author: "",
      abstract: "",
      sections: [],
      equations: [],
      references: [],
      paragraphs: [],
    };
  }

  const titleMatch = tex.match(/\\title\{([^}]+)\}/);
  const title = titleMatch ? titleMatch[1].replace(/\\textbf\{([^}]+)\}/g, "$1") : "Untitled Manuscript";

  const authorMatch = tex.match(/\\author\{([^}]+)\}/);
  const author = authorMatch ? authorMatch[1].replace(/\\textbf\{([^}]+)\}/g, "$1").replace(/\\\\/g, " · ") : "";

  const abstractMatch = tex.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
  const abstract = abstractMatch ? abstractMatch[1].trim() : "";

  const sectionMatches = [...tex.matchAll(/\\section\{([^}]+)\}/g)];
  const sections = sectionMatches.map((m) => m[1]);

  const eqMatches = [
    ...tex.matchAll(/\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g),
    ...tex.matchAll(/\\\[([\s\S]*?)\\\]/g),
  ];
  const equations = eqMatches.map((m) =>
    m[1]
      .trim()
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)")
      .replace(/\\sum_\{([^}]+)\}\^?\{?([^}]*)\}?/g, "∑($1..$2)")
      .replace(/\\int_\{([^}]+)\}\^?\{?([^}]*)\}?/g, "∫($1..$2)")
      .replace(/\\text\{([^}]+)\}/g, "$1")
      .replace(/\\mathbf\{([^}]+)\}/g, "$1")
      .replace(/\\left|\\right/g, "")
      .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
      .replace(/\\pm/g, "±")
      .replace(/\\theta/g, "θ")
      .replace(/\\lambda/g, "λ")
  );

  const bibMatches = [...tex.matchAll(/\\bibitem\{([^}]+)\}\s*([^\n\\]+)/g)];
  const references = bibMatches.map((m) => m[2].replace(/\\textit\{([^}]+)\}/g, "$1").trim());

  const cleanBody = tex
    .replace(/\\documentclass[\s\S]*?\\begin\{document\}/, "")
    .replace(/\\end\{document\}[\s\S]*/, "")
    .replace(/\\begin\{abstract\}[\s\S]*?\\end\{abstract\}/, "")
    .replace(/\\begin\{thebibliography\}[\s\S]*?\\end\{thebibliography\}/, "")
    .replace(/\\begin\{equation\}[\s\S]*?\\end\{equation\}/g, "")
    .replace(/\\section\{[^}]+\}/g, "")
    .replace(/\\maketitle/g, "")
    .replace(/\\cite\{[^}]+\}/g, "[1]")
    .replace(/\\textbf\{([^}]+)\}/g, "$1")
    .replace(/\\textit\{([^}]+)\}/g, "$1")
    .trim();

  const paragraphs = cleanBody
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 8 && !p.startsWith("%") && !p.startsWith("\\"));

  return {
    title,
    author,
    abstract,
    sections,
    equations,
    references,
    paragraphs,
  };
}

export function LatexPdfViewerPage({
  token,
  user,
  apiFetch,
  onSignIn,
  onSaveDownload,
}: LatexPdfViewerPageProps) {
  const [title, setTitle] = useState("manuscript.tex");
  const [source, setSource] = useState(SAMPLE_LATEX);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<"split" | "editor" | "pdf">("split");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [preparedPdf, setPreparedPdf] = useState<{
    url: string;
    fileName: string;
    blob: Blob;
  } | null>(null);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);

  const authenticated = useMemo(() => {
    if (user && (user.id || user.email)) return true;
    if (token && token.trim().length > 0) return true;
    return hasCloudSession(token);
  }, [user, token]);

  const parsedDoc = useMemo(() => parseLatexInRealtime(source), [source]);

  useEffect(
    () => () => {
      if (preparedPdf) URL.revokeObjectURL(preparedPdf.url);
    },
    [preparedPdf?.url],
  );

  const startNewManuscript = () => {
    setTitle("untitled.tex");
    setSource(NEW_LATEX_TEMPLATE);
    setPdfFile(null);
    setPreparedPdf(null);
    setCopied(false);
    setError("");
    setNotice("New blank manuscript created.");
  };

  const handleCopyCode = async () => {
    setError("");
    setNotice("");
    try {
      let copyError: unknown = new Error("Clipboard access is unavailable.");
      let copiedToClipboard = false;

      if (navigator.clipboard?.writeText) {
        let timeoutId: number | undefined;
        try {
          await Promise.race([
            navigator.clipboard.writeText(source),
            new Promise<void>((_resolve, reject) => {
              timeoutId = window.setTimeout(
                () => reject(new Error("Clipboard access timed out.")),
                1500,
              );
            }),
          ]);
          copiedToClipboard = true;
        } catch (cause) {
          copyError = cause;
        } finally {
          if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        }
      }

      if (!copiedToClipboard) {
        const fallbackInput = document.createElement("textarea");
        fallbackInput.value = source;
        fallbackInput.setAttribute("readonly", "");
        fallbackInput.style.position = "fixed";
        fallbackInput.style.opacity = "0";
        document.body.appendChild(fallbackInput);
        fallbackInput.select();
        let fallbackCopied = false;
        try {
          fallbackCopied = document.execCommand("copy");
        } finally {
          fallbackInput.remove();
        }
        if (!fallbackCopied) {
          throw new Error(
            `Clipboard copy failed: ${getErrorMessage(copyError, "permission denied")}.`,
          );
        }
      }

      setCopied(true);
      setNotice("LaTeX source copied to the clipboard.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch (cause) {
      setCopied(false);
      setError(getErrorMessage(cause, "Could not copy the LaTeX source."));
    }
  };

  const downloadSource = async () => {
    const baseName = (title.replace(/\.tex$/i, "").trim() || "manuscript")
      .replace(/[\\/:*?"<>|]/g, "-");
    const fileName = `${baseName}.tex`;
    const blob = new Blob([source], { type: "text/x-tex;charset=utf-8" });
    setError("");
    setNotice("");

    try {
      if (Capacitor.isNativePlatform() && onSaveDownload) {
        await onSaveDownload(blob, fileName);
        setNotice(`Saved ${fileName} to Downloads/CLIO`);
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setNotice(`Source download started: ${fileName}`);
    } catch (cause) {
      setError(getErrorMessage(cause, "Could not export the LaTeX source."));
    }
  };

  const convertToPdf = async () => {
    setError("");
    setNotice("");
    setIsConvertingPdf(true);

    try {
      let blob: Blob;
      let fileName: string;

      if (pdfFile) {
        blob = pdfFile;
        fileName = pdfFile.name;
      } else {
        if (!apiFetch) {
          throw new Error("LaTeX compilation is unavailable because the CLIO API is not configured.");
        }
        if (!token || token.startsWith("local-token-")) {
          throw new Error("Sign in to your CLIO account to compile LaTeX to PDF.");
        }
        blob = await apiFetch<Blob>(
          "/latex/compile",
          {
            method: "POST",
            body: JSON.stringify({ source }),
          },
          token,
        );
        if (!(blob instanceof Blob) || blob.type !== "application/pdf") {
          throw new Error("The LaTeX compiler returned an invalid PDF response.");
        }
        fileName = getManuscriptPdfFilename(title);
      }

      const url = URL.createObjectURL(blob);
      setPreparedPdf({ url, fileName, blob });
      setNotice(`PDF is ready to download: ${fileName}`);
    } catch (cause) {
      setError(getErrorMessage(cause, "Could not convert the manuscript to PDF."));
    } finally {
      setIsConvertingPdf(false);
    }
  };

  const importTex = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const text = await file.text();
      setSource(text);
      setTitle(file.name);
      setPdfFile(null);
      setPreparedPdf(null);
      setNotice(`Loaded ${file.name}`);
    } catch (cause) {
      setError(getErrorMessage(cause, "Could not read .tex file."));
    } finally {
      event.target.value = "";
    }
  };

  const importPdf = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setPdfFile(file);
    setPreparedPdf({
      url: URL.createObjectURL(file),
      fileName: file.name,
      blob: file,
    });
    setNotice(`Loaded PDF: ${file.name}. It is ready to download.`);
    event.target.value = "";
  };

  return (
    <div className="clio-feature-page space-y-6 pb-12 text-neutral-100 max-w-5xl mx-auto px-4">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/40 via-indigo-950/20 to-neutral-950 space-y-4 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
              <Sparkles className="h-3.5 w-3.5" />
              LaTeX & Embedded PDF.js Manuscript Viewer
            </div>

            {authenticated ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-800/60 bg-blue-950/60 text-xs font-medium text-blue-300">
                <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                Account Active
              </span>
            ) : (
              <button onClick={onSignIn} className="text-xs text-neutral-400 underline hover:text-white">
                Sign in
              </button>
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-neutral-100 md:text-3xl tracking-tight">
            LaTeX Editor & PDF.js Manuscript Viewer
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-neutral-300">
            Real-time LaTeX manuscript editor, live math formula rendering, and embedded PDF.js document viewer with zoom, text search, and page controls.
          </p>
          <p className="max-w-2xl text-xs leading-relaxed text-neutral-400">
            Compile your LaTeX source with the server-side TeX engine, then download the resulting PDF.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 bg-neutral-900/90 p-1 rounded-xl border border-neutral-800 text-xs font-medium">
              <button
                onClick={() => setViewMode("split")}
                aria-pressed={viewMode === "split"}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === "split" ? "bg-blue-600 text-white font-bold" : "text-neutral-400 hover:text-white"
                }`}
              >
                <Split className="w-3.5 h-3.5" /> Split View
              </button>
              <button
                onClick={() => setViewMode("editor")}
                aria-pressed={viewMode === "editor"}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === "editor" ? "bg-blue-600 text-white font-bold" : "text-neutral-400 hover:text-white"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" /> LaTeX Source
              </button>
              <button
                onClick={() => setViewMode("pdf")}
                aria-pressed={viewMode === "pdf"}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === "pdf" ? "bg-blue-600 text-white font-bold" : "text-neutral-400 hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> PDF.js Render
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <button
                onClick={startNewManuscript}
                disabled={isConvertingPdf}
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 transition-all"
              >
                <FilePlus2 className="w-3.5 h-3.5" /> New
              </button>

              <label className={`px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 transition-all ${isConvertingPdf ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
                <FileUp className="w-3.5 h-3.5" /> Import .tex
                <input type="file" accept=".tex,text/x-tex" className="sr-only" disabled={isConvertingPdf} onChange={importTex} />
              </label>

              <button
                onClick={handleCopyCode}
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-blue-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>

              <button
                onClick={downloadSource}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-blue-600/20"
              >
                <Download className="w-3.5 h-3.5" /> Export .tex
              </button>
              {preparedPdf ? (
                <a
                  href={preparedPdf.url}
                  download={preparedPdf.fileName}
                  onClick={async (event) => {
                    if (Capacitor.isNativePlatform() && onSaveDownload) {
                      event.preventDefault();
                      setError("");
                      try {
                        await onSaveDownload(preparedPdf.blob, preparedPdf.fileName);
                        setNotice(`Saved ${preparedPdf.fileName} to Downloads/CLIO`);
                      } catch (cause) {
                        setError(getErrorMessage(cause, "Could not save the PDF to Downloads."));
                      }
                    } else {
                      setNotice(`PDF download started: ${preparedPdf.fileName}`);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/20"
                >
                  <FileText className="w-3.5 h-3.5" /> Download PDF
                </a>
              ) : (
                <button
                  onClick={convertToPdf}
                  type="button"
                  disabled={isConvertingPdf}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                  aria-live="polite"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {isConvertingPdf ? "Converting..." : pdfFile ? "Prepare PDF Download" : "Convert to PDF"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-900 text-xs text-neutral-300">
          {notice}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl border border-neutral-700 bg-neutral-900 text-xs text-neutral-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-neutral-300 shrink-0" />
          {error}
        </div>
      )}

      {/* Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Code Editor Column */}
        {(viewMode === "split" || viewMode === "editor") && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 flex flex-col overflow-hidden shadow-xl">
            <div className="p-3.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-neutral-200">
                <Code2 className="w-4 h-4 text-blue-400" />
                <input
                  value={title}
                  disabled={isConvertingPdf}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setPreparedPdf(null);
                  }}
                  className="bg-transparent border-none focus:outline-none font-mono text-xs text-neutral-200 w-36"
                />
              </div>
              <span className="text-neutral-500">{source.split("\n").length} lines</span>
            </div>

            <textarea
              value={source}
              disabled={isConvertingPdf}
              onChange={(e) => {
                setSource(e.target.value);
                setPdfFile(null);
                setPreparedPdf(null);
              }}
              placeholder="% Type or paste LaTeX source code here..."
              className="flex-1 min-h-[460px] p-4 bg-neutral-950 text-neutral-200 font-mono text-xs leading-relaxed focus:outline-none resize-none border-none"
              spellCheck={false}
            />
          </div>
        )}

        {/* PDF / LaTeX Render Column */}
        {(viewMode === "split" || viewMode === "pdf") && (
          <div
            className={`rounded-2xl border border-neutral-800 bg-neutral-900 flex flex-col overflow-hidden shadow-xl ${
              viewMode === "pdf" ? "lg:col-span-2" : ""
            }`}
          >
            <div className="p-3.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-bold text-neutral-200">
                <Eye className="w-4 h-4 text-blue-400" />
                <span>{pdfFile ? `PDF: ${pdfFile.name}` : "Live LaTeX Render"}</span>
              </div>

              <label className={`px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 text-xs font-medium ${isConvertingPdf ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
                <FileUp className="w-3.5 h-3.5" /> Choose PDF
                <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={isConvertingPdf} onChange={importPdf} />
              </label>
            </div>

            <div className="flex-1 p-5 bg-neutral-950 text-xs text-neutral-200 overflow-y-auto min-h-[460px]">
              {pdfFile ? (
                <LocalPdfJsViewer file={pdfFile} />
              ) : (
                /* Live LaTeX Manuscript Preview */
                <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-xl space-y-4 leading-relaxed shadow-lg">
                  <div className="text-center space-y-1 border-b border-neutral-800 pb-4">
                    <h2 className="text-base font-bold text-neutral-100">{parsedDoc.title}</h2>
                    {parsedDoc.author && (
                      <p className="text-xs text-blue-400 font-semibold">{parsedDoc.author}</p>
                    )}
                  </div>

                  {parsedDoc.abstract && (
                    <div className="p-3.5 bg-blue-950/20 rounded-xl border border-blue-900/30 space-y-1">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-blue-300">
                        Abstract
                      </span>
                      <p className="text-neutral-300 italic text-[11px] leading-relaxed">
                        {parsedDoc.abstract}
                      </p>
                    </div>
                  )}

                  {parsedDoc.sections.map((sec, idx) => (
                    <div key={idx} className="space-y-1">
                      <h3 className="font-bold text-neutral-100 text-xs">{sec}</h3>
                    </div>
                  ))}

                  {parsedDoc.paragraphs.map((p, idx) => (
                    <p key={idx} className="text-neutral-300 leading-relaxed">
                      {p}
                    </p>
                  ))}

                  {parsedDoc.equations.length > 0 && (
                    <div className="space-y-2 p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 font-mono">
                      <div className="text-[10px] uppercase font-sans font-bold text-neutral-400">
                        Rendered Equations:
                      </div>
                      {parsedDoc.equations.map((eq, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800 text-center text-blue-300 text-xs font-semibold"
                        >
                          {eq}
                        </div>
                      ))}
                    </div>
                  )}

                  {parsedDoc.references.length > 0 && (
                    <div className="border-t border-neutral-800 pt-3 text-[11px] text-neutral-400 space-y-1">
                      <div className="font-bold text-neutral-300">References</div>
                      {parsedDoc.references.map((ref, idx) => (
                        <p key={idx}>[{idx + 1}] {ref}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
