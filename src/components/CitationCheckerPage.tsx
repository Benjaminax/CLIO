import React, { useMemo, useState } from "react";
import {
  FileCheck,
  Search,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Copy,
  Download,
  Upload,
  RefreshCw,
  ExternalLink,
  BookOpen,
  FileText,
  ShieldAlert,
  Sparkles,
  Layers,
  ListOrdered,
  FileCode,
  ArrowRight,
  Check,
  UserCheck,
} from "lucide-react";
import { analyzeInlineCitations, extractReferences } from "./citationAnalysis";
import { extractCitationDocumentText } from "./citationDocumentText";
import { FeatureApiFetch, getErrorMessage, hasCloudSession } from "./featureApi";

interface Reference {
  id: string;
  index: number;
  rawText: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string;
  doi?: string;
  status: "verified" | "metadata_mismatch" | "missing" | "hallucinated" | "unverified";
  confidenceScore: number;
  databaseMatch?: string;
  mismatches?: string[];
  correctedBibtex?: string;
  correctedText?: string;
}

interface InlineDefect {
  type: "gap" | "out_of_order" | "uncited" | "undefined" | "duplicate" | "range_error";
  severity: "high" | "medium" | "low";
  marker?: string;
  index?: number;
  description: string;
  suggestion: string;
}

interface LibraryItem {
  id: string;
  title: string;
  author: string;
}

interface UserInfo {
  id: string;
  email: string;
  full_name?: string;
  username?: string;
}

interface CitationCheckerPageProps {
  items?: LibraryItem[];
  token?: string | null;
  user?: UserInfo | null;
  apiFetch?: FeatureApiFetch;
  onSignIn?: () => void;
}

export function CitationCheckerPage({ token, user, apiFetch, onSignIn }: CitationCheckerPageProps) {
  const [activeTab, setActiveTab] = useState<"audit" | "defects" | "input" | "bibtex">("audit");
  const [inputText, setInputText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [auditMessage, setAuditMessage] = useState("");
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [references, setReferences] = useState<Reference[]>([]);
  const [defects, setDefects] = useState<InlineDefect[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const authenticated = useMemo(() => {
    if (user && (user.id || user.email)) return true;
    if (token && token.trim().length > 0) return true;
    return hasCloudSession(token);
  }, [user, token]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadError("");
    setInputText("");
    setUploadedFileName("");
    setAuditMessage("");
    setReferences([]);
    setDefects([]);
    setIsExtractingFile(true);

    try {
      const extractedText = await extractCitationDocumentText(file);
      setInputText(extractedText);
      setUploadedFileName(file.name);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Unable to read the selected file.",
      );
    } finally {
      setIsExtractingFile(false);
    }
  };

  const runAudit = async () => {
    const sourceText = inputText.trim();
    if (!sourceText) {
      setUploadError("Upload a supported file or paste manuscript text before running the scan.");
      setActiveTab("input");
      return;
    }

    setIsAuditing(true);
    setIsVerifying(false);
    setUploadError("");
    setAuditMessage("");

    try {
      const extractedReferences = extractReferences(sourceText);
      const extractedDefects = analyzeInlineCitations(sourceText, extractedReferences);
      setReferences(extractedReferences);
      setDefects(extractedDefects);
      setFilterStatus("all");

      if (extractedReferences.length === 0) {
        setAuditMessage(
          "No bibliography entries were found. Check the document's References section or paste the reference list.",
        );
      } else {
        const verifiableReferences = extractedReferences.filter(
          (reference) => !/^Reference \d+$/.test(reference.title),
        );

        if (apiFetch && token && !token.startsWith("local-token-") && verifiableReferences.length) {
          setIsVerifying(true);
          try {
            const verification = await apiFetch<{
              results: Array<{
                id: string;
                status: Reference["status"];
                confidenceScore: number;
                databaseMatch?: string | null;
                doi?: string;
                mismatches?: string[];
                matchedTitle?: string;
                matchedYear?: number | null;
                matchedAuthors?: string[];
                matchedVenue?: string;
              }>;
            }>(
              "/citation-checker/verify",
              {
                method: "POST",
                body: JSON.stringify({
                  references: verifiableReferences.slice(0, 50).map((reference) => ({
                    id: reference.id,
                    title: reference.title,
                    authors: reference.authors,
                    year: reference.year,
                  })),
                }),
              },
              token,
            );
            if (!Array.isArray(verification.results)) {
              throw new Error("Crossref returned an invalid verification response.");
            }

            const resultById = new Map(verification.results.map((result) => [result.id, result]));
            const updatedReferences = extractedReferences.map((reference) => {
              const result = resultById.get(reference.id);
              return result
                ? {
                    ...reference,
                    title: result.matchedTitle || reference.title,
                    authors: result.matchedAuthors?.length
                      ? result.matchedAuthors
                      : reference.authors,
                    year: result.matchedYear ?? reference.year,
                    venue: result.matchedVenue || reference.venue,
                    status: result.status,
                    confidenceScore: result.confidenceScore,
                    databaseMatch: result.databaseMatch || "Crossref",
                    doi: result.doi,
                    mismatches: result.mismatches || [],
                  }
                : reference;
            });
            setReferences(updatedReferences);
            setAuditMessage(
              `Extracted ${extractedReferences.length} references and checked ${verification.results.length} against Crossref.${
                verifiableReferences.length > 50 ? " Only the first 50 references were checked." : ""
              }`,
            );
          } catch (error) {
            setAuditMessage(
              `Local scan complete, but Crossref verification failed: ${getErrorMessage(error, "request failed")}. References remain unverified.`,
            );
          } finally {
            setIsVerifying(false);
          }
        } else {
          setAuditMessage(
            `Extracted ${extractedReferences.length} references. Sign in to verify their metadata against Crossref.`,
          );
        }
      }
      setActiveTab("audit");
    } catch (error) {
      setUploadError(getErrorMessage(error, "Unable to scan this document."));
      setActiveTab("input");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredReferences = references.filter((ref) => {
    if (filterStatus === "all") return true;
    return ref.status === filterStatus;
  });

  const stats = {
    total: references.length,
    verified: references.filter((r) => r.status === "verified").length,
    mismatches: references.filter((r) => r.status === "metadata_mismatch").length,
    unverified: references.filter((r) => r.status === "unverified").length,
    hallucinated: references.filter((r) => r.status === "hallucinated").length,
    defectsCount: defects.length,
  };

  return (
    <div className="clio-feature-page space-y-6 pb-12 text-neutral-100 max-w-5xl mx-auto px-4">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-neutral-950 space-y-4 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />
              RefChecker Citation Integrity Engine
            </div>

            {authenticated ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-800/60 bg-indigo-950/60 text-xs font-medium text-indigo-300">
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                Account Active
              </span>
            ) : (
              <button
                onClick={onSignIn}
                className="text-xs text-neutral-400 underline hover:text-white"
              >
                Sign in
              </button>
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-neutral-100 md:text-3xl tracking-tight">
            Academic Citation & Reference Checker
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-neutral-300">
            Extract references from your manuscript, check numeric citation consistency, and compare reference metadata with Crossref when signed in.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={runAudit}
              disabled={isAuditing || isVerifying || isExtractingFile}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50 flex items-center gap-2"
            >
              {isAuditing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileCheck className="w-4 h-4" />
              )}
              {isExtractingFile
                ? "Reading uploaded file..."
                : isVerifying
                ? "Verifying with Crossref..."
                : isAuditing
                  ? "Auditing Citations..."
                  : "Run Citation Scan"}
            </button>

            <button
              onClick={() => setActiveTab("input")}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition-all flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Paper / Paste
            </button>
          </div>
        </div>
      </div>

      {/* Stat Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-medium">
        <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-md">
          <div className="text-neutral-400 font-semibold">Total References</div>
          <div className="text-2xl font-extrabold text-neutral-100 mt-1">{stats.total}</div>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 shadow-md">
          <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Verified
          </div>
          <div className="text-2xl font-extrabold text-emerald-300 mt-1">{stats.verified}</div>
        </div>
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/40 shadow-md">
          <div className="text-amber-400 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Mismatches
          </div>
          <div className="text-2xl font-extrabold text-amber-300 mt-1">{stats.mismatches}</div>
        </div>
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/50 shadow-md">
          <div className="text-rose-400 font-semibold flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" /> Hallucinated
          </div>
          <div className="text-2xl font-extrabold text-rose-300 mt-1">{stats.hallucinated}</div>
        </div>
        <div className="p-4 rounded-2xl bg-orange-950/30 border border-orange-800/40 shadow-md">
          <div className="text-orange-400 font-semibold flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4" /> Unverified
          </div>
          <div className="text-2xl font-extrabold text-orange-300 mt-1">{stats.unverified}</div>
        </div>
        <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-800/40 shadow-md">
          <div className="text-purple-400 font-semibold flex items-center gap-1.5">
            <ListOrdered className="w-4 h-4" /> Defects
          </div>
          <div className="text-2xl font-extrabold text-purple-300 mt-1">{stats.defectsCount}</div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-neutral-800 space-x-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("audit")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "audit"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <FileCheck className="w-4 h-4" />
          Reference Verification ({stats.total})
        </button>
        <button
          onClick={() => setActiveTab("defects")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "defects"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          Inline Citation Defects ({stats.defectsCount})
        </button>
        <button
          onClick={() => setActiveTab("input")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "input"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Upload className="w-4 h-4" />
          Input & Upload
        </button>
        <button
          onClick={() => setActiveTab("bibtex")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "bibtex"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <FileCode className="w-4 h-4" />
          Corrected BibTeX
        </button>
      </div>

      {/* TAB 1: Verification List */}
      {activeTab === "audit" && (
        <div className="space-y-4 text-xs">
          {auditMessage && (
            <p role="status" className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-indigo-300">
              {auditMessage}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-neutral-400">Filter Status:</span>
              {["all", "verified", "metadata_mismatch", "unverified", "hallucinated", "missing"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-all border ${
                    filterStatus === st
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                      : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  {st.replace("_", " ")}
                </button>
              ))}
            </div>

            <div className="text-neutral-400">
              {filteredReferences.length} of {references.length} entries
            </div>
          </div>

          <div className="space-y-3">
            {filteredReferences.length === 0 ? (
              <p className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5 text-neutral-400">
                {references.length
                  ? "No references match this status filter."
                  : "Upload a manuscript or paste a reference list, then run a scan to see results."}
              </p>
            ) : filteredReferences.map((ref) => (
              <div
                key={ref.id}
                className={`p-5 rounded-2xl border transition-all ${
                  ref.status === "verified"
                    ? "bg-neutral-900/80 border-emerald-900/40"
                    : ref.status === "metadata_mismatch"
                    ? "bg-amber-950/20 border-amber-800/50"
                    : ref.status === "hallucinated"
                    ? "bg-rose-950/30 border-rose-800/60 shadow-lg shadow-rose-950/20"
                    : "bg-neutral-900/80 border-neutral-800"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-neutral-800 font-mono font-bold text-neutral-200">
                      [{ref.index}]
                    </span>

                    {ref.status === "verified" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified Match ({ref.confidenceScore}% confidence)
                      </span>
                    )}

                    {ref.status === "metadata_mismatch" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" /> Metadata Discrepancy
                      </span>
                    )}

                    {ref.status === "hallucinated" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 font-bold animate-pulse">
                        <ShieldAlert className="w-3.5 h-3.5" /> Fabricated AI Reference
                      </span>
                    )}

                    {ref.status === "missing" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 font-semibold">
                        <HelpCircle className="w-3.5 h-3.5" /> Unindexed Match
                      </span>
                    )}

                    {ref.status === "unverified" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 font-semibold">
                        <HelpCircle className="w-3.5 h-3.5" /> Not verified
                      </span>
                    )}

                    {ref.databaseMatch && (
                      <span className="text-neutral-400 border border-neutral-800 px-2 py-0.5 rounded">
                        DB: {ref.databaseMatch}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-neutral-100 text-sm">{ref.title}</h3>
                  <p className="text-neutral-400">
                    {ref.authors.join(", ")} {ref.year ? `(${ref.year})` : ""} ·{" "}
                    <span className="text-neutral-300 italic">{ref.venue}</span>
                  </p>

                  <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 font-mono text-xs text-neutral-300 leading-relaxed">
                    {ref.rawText}
                  </div>

                  {ref.mismatches && ref.mismatches.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-900/30 space-y-1">
                      <div className="font-semibold text-amber-300">Detected Mismatches:</div>
                      <ul className="text-amber-200/80 space-y-0.5 list-disc list-inside">
                        {ref.mismatches.map((m, idx) => (
                          <li key={idx}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {ref.correctedText && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 space-y-1">
                      <div className="font-semibold text-emerald-400 flex items-center justify-between">
                        <span>Verified Citation Entry:</span>
                        <button
                          onClick={() => handleCopy(ref.correctedText!, ref.id)}
                          className="text-neutral-400 hover:text-emerald-300 flex items-center gap-1 text-[11px]"
                        >
                          {copiedId === ref.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedId === ref.id ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="font-mono text-neutral-200 text-xs">{ref.correctedText}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Inline Defects */}
      {activeTab === "defects" && (
        <div className="space-y-3 text-xs">
          {defects.length === 0 ? (
            <p className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5 text-neutral-400">
              {auditMessage
                ? "No numeric citation defects were detected."
                : "Run a scan to check citation numbering in your manuscript."}
            </p>
          ) : defects.map((def, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/80 space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                    def.severity === "high"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : def.severity === "medium"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                  }`}
                >
                  {def.type.replace("_", " ")}
                </span>
                {def.marker && (
                  <span className="font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                    {def.marker}
                  </span>
                )}
              </div>
              <p className="font-medium text-neutral-100">{def.description}</p>
              <p className="text-indigo-300 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Fix: {def.suggestion}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: Input & File Upload */}
      {activeTab === "input" && (
        <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/90 space-y-4 text-xs">
          <h2 className="font-bold text-neutral-100 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            Upload Manuscript or Paste Reference List
          </h2>

          <div className="space-y-1.5">
            <label className="text-neutral-400 font-medium">Upload PDF/DOCX/Text/LaTeX Paper:</label>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,.tex,.bib"
              onChange={handleFileUpload}
              disabled={isExtractingFile || isAuditing || isVerifying}
              className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs focus:outline-none"
            />
          </div>
          {isExtractingFile && (
            <p role="status" className="text-indigo-300">Reading text from the selected file...</p>
          )}
          {uploadedFileName && (
            <p role="status" className="text-emerald-400">
              Loaded {uploadedFileName} ({inputText.length.toLocaleString()} characters).
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-neutral-400 font-medium">Or Paste Manuscript / BibTeX Text:</label>
            <textarea
              value={inputText}
              disabled={isExtractingFile || isAuditing || isVerifying}
              onChange={(e) => {
                setInputText(e.target.value);
                setUploadedFileName("");
                setUploadError("");
                setAuditMessage("");
                setReferences([]);
                setDefects([]);
              }}
              placeholder="Paste references or manuscript text here..."
              rows={8}
              className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 font-mono text-xs focus:outline-none leading-relaxed"
            />
          </div>

          {uploadError && <p role="alert" className="text-rose-400 font-medium">{uploadError}</p>}

          <button
            onClick={runAudit}
            disabled={isAuditing || isVerifying || isExtractingFile}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
          >
            {isAuditing || isVerifying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileCheck className="w-4 h-4" />
            )}
            {isExtractingFile
              ? "Reading uploaded file..."
              : isVerifying
              ? "Verifying with Crossref..."
              : isAuditing
                ? "Auditing Citations..."
                : "Run RefChecker Citation Audit"}
          </button>
        </div>
      )}

      {/* TAB 4: Corrected BibTeX */}
      {activeTab === "bibtex" && (
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-neutral-200">Corrected BibTeX Entries</h3>
            <button
              onClick={() =>
                handleCopy(
                  references
                    .filter((r) => r.correctedBibtex)
                    .map((r) => r.correctedBibtex)
                    .join("\n\n"),
                  "all-bib"
                )
              }
              className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium border border-neutral-700 flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedId === "all-bib" ? "Copied All" : "Copy BibTeX"}
            </button>
          </div>

          <pre className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 font-mono text-emerald-300 leading-relaxed overflow-x-auto">
            {references
              .filter((r) => r.correctedBibtex)
              .map((r) => r.correctedBibtex)
              .join("\n\n") || "% Run citation audit to generate BibTeX entries."}
          </pre>
        </div>
      )}
    </div>
  );
}
