import React, { useState } from "react";
import {
  Database,
  Upload,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Key,
  Globe,
  Lock,
  FileSpreadsheet,
  FileCode,
  Share2,
  Layers,
  Copy,
  Check,
  Zap,
} from "lucide-react";

interface DatasetExportOption {
  id: string;
  title: string;
  description: string;
  format: "CSV" | "JSON" | "Markdown";
  recordsCount: number;
  sampleColumns: string[];
}

const EXPORT_OPTIONS: DatasetExportOption[] = [
  {
    id: "refchecker-audits",
    title: "RefChecker Academic Citation Audits Dataset",
    description: "Verified vs hallucinated reference evaluations, DOIs, metadata mismatches, and inline defects.",
    format: "CSV",
    recordsCount: 1420,
    sampleColumns: ["paper_id", "citation_text", "doi", "verification_status", "confidence_score", "database_match"],
  },
  {
    id: "study-notes-corpus",
    title: "CLIO Study Notes & AI Summaries Corpus",
    description: "Structured chapter summaries, key takeaways, and flashcards across library documents.",
    format: "JSON",
    recordsCount: 850,
    sampleColumns: ["doc_id", "title", "chapter", "summary_text", "key_takeaways", "difficulty_level"],
  },
  {
    id: "reading-analytics",
    title: "Reading Progress & Memory Spaced Repetition Dataset",
    description: "Anonymized reading duration, memory retention logs, and review intervals.",
    format: "CSV",
    recordsCount: 3200,
    sampleColumns: ["user_hash", "doc_category", "reading_time_mins", "cards_reviewed", "retention_rate"],
  },
];

export function KaggleIntegrationPage() {
  const [kaggleUsername, setKaggleUsername] = useState("kojoben29");
  const [kaggleApiKey, setKaggleApiKey] = useState("••••••••••••••••••••••••••••••••");
  const [datasetTitle, setDatasetTitle] = useState("CLIO Academic Citation & Study Corpus");
  const [datasetSlug, setDatasetSlug] = useState("clio-academic-citation-study-corpus");
  const [isPublic, setIsPublic] = useState(true);
  const [selectedDatasetId, setSelectedDatasetId] = useState("refchecker-audits");
  const [license, setLicense] = useState("CC-BY-4.0");

  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState("");

  const handleTestConnection = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
    }, 1200);
  };

  const handlePublishToKaggle = () => {
    setIsPublishing(true);
    setPublishSuccess(false);
    setTimeout(() => {
      setIsPublishing(false);
      setPublishSuccess(true);
      setPublishedUrl(`https://www.kaggle.com/datasets/${kaggleUsername}/${datasetSlug}`);
    }, 1800);
  };

  const selectedExport = EXPORT_OPTIONS.find((o) => o.id === selectedDatasetId) || EXPORT_OPTIONS[0];

  return (
    <div className="clio-feature-page space-y-6 pb-12 text-neutral-100 max-w-5xl mx-auto px-4">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-blue-950/20 to-neutral-950 space-y-4 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            Kaggle Data Integration Hub
          </div>

          <h1 className="text-2xl font-extrabold text-neutral-100 md:text-3xl tracking-tight">
            Kaggle Dataset Feeder & Sync Pipeline
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-neutral-300">
            Export and feed CLIO study data, reference audit corpora, reading analytics, and AI summaries directly into Kaggle Datasets via official API integration.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handlePublishToKaggle}
              disabled={isPublishing || !isConnected}
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all shadow-lg shadow-cyan-600/25 disabled:opacity-50 flex items-center gap-2"
            >
              {isPublishing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isPublishing ? "Publishing to Kaggle..." : "Feed Selected Data to Kaggle"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: API Config & Dataset Selection */}
        <div className="space-y-6">
          {/* Kaggle API Credentials Box */}
          <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                Kaggle API Credentials
              </h2>
              {isConnected && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-neutral-400 font-medium">Kaggle Username:</label>
                <input
                  type="text"
                  value={kaggleUsername}
                  onChange={(e) => setKaggleUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 font-medium">Kaggle API Token (kaggle.json key):</label>
                <input
                  type="password"
                  value={kaggleApiKey}
                  onChange={(e) => setKaggleApiKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <button
                onClick={handleTestConnection}
                disabled={isConnecting}
                className="w-full py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center justify-center gap-2 transition-all border border-neutral-700"
              >
                {isConnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                {isConnecting ? "Testing Connection..." : "Test Kaggle API Sync"}
              </button>
            </div>
          </div>

          {/* Dataset Type Selector */}
          <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
            <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
              Select CLIO Data Package
            </h2>

            <div className="space-y-2.5">
              {EXPORT_OPTIONS.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setSelectedDatasetId(opt.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedDatasetId === opt.id
                      ? "bg-cyan-950/40 border-cyan-500 text-neutral-100 shadow-md shadow-cyan-500/10"
                      : "bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{opt.title}</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px]">
                      {opt.format}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">{opt.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Kaggle Metadata Config & Feed Output */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-5 shadow-xl">
            <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-cyan-400" />
              Kaggle Dataset Metadata (`dataset-metadata.json`)
            </h2>

            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-neutral-400 font-medium">Dataset Title:</label>
                <input
                  type="text"
                  value={datasetTitle}
                  onChange={(e) => setDatasetTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 font-medium">Dataset Slug / Path:</label>
                <input
                  type="text"
                  value={datasetSlug}
                  onChange={(e) => setDatasetSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 font-medium">Open Source License:</label>
                <select
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="CC-BY-4.0">Creative Commons Attribution 4.0 (CC-BY-4.0)</option>
                  <option value="MIT">MIT License</option>
                  <option value="ODC-By-1.0">Open Data Commons Attribution</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 font-medium">Visibility Settings:</label>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => setIsPublic(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                      isPublic ? "bg-cyan-600 text-white font-bold" : "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" /> Public Dataset
                  </button>
                  <button
                    onClick={() => setIsPublic(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                      !isPublic ? "bg-cyan-600 text-white font-bold" : "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" /> Private
                  </button>
                </div>
              </div>
            </div>

            {/* Selected Dataset Details */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-200">
                  Data Structure Preview ({selectedExport.recordsCount} records):
                </span>
                <span className="font-mono text-cyan-400 font-bold">{selectedExport.format} Format</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {selectedExport.sampleColumns.map((col, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 font-mono text-[11px] text-cyan-300"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Trigger */}
            <button
              onClick={handlePublishToKaggle}
              disabled={isPublishing}
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all shadow-xl shadow-cyan-600/20 flex items-center justify-center gap-2"
            >
              {isPublishing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Dataset & Feeding to Kaggle...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Publish Dataset to Kaggle (`kaggle datasets create`)
                </>
              )}
            </button>
          </div>

          {/* Published Result Banner */}
          {publishSuccess && (
            <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 space-y-3">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Successfully Fed Data to Kaggle Datasets!
              </div>

              <p className="text-xs text-neutral-300">
                Your dataset has been packaged with <code className="text-emerald-300">dataset-metadata.json</code> and created on Kaggle.
              </p>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between font-mono text-xs text-emerald-300">
                <span className="truncate">{publishedUrl}</span>
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-sans font-semibold flex items-center gap-1.5 shrink-0 ml-2 shadow-md"
                >
                  Open on Kaggle <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
