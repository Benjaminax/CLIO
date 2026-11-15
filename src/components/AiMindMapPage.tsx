import React, { useEffect, useMemo, useState } from "react";
import {
  Brain,
  Sparkles,
  Network,
  BookOpen,
  CheckCircle2,
  Clock,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Search,
  Download,
  Share2,
  Target,
  GraduationCap,
  Layers,
  ArrowRight,
  Check,
  Zap,
  UserCheck,
  AlertCircle,
  LoaderCircle,
  Circle,
  FileText,
  Upload,
} from "lucide-react";
import { FeatureApiFetch, getErrorMessage, hasCloudSession } from "./featureApi";
import { extractCitationDocumentText } from "./citationDocumentText";
import { createExtractiveMindMap, isMindMapRecord } from "./mindMapGeneration";

type MasteryStatus = "to_learn" | "in_progress" | "mastered";

interface MindNode {
  id: string;
  label: string;
  category: "central" | "theme" | "concept" | "action";
  priority: "high" | "medium" | "low";
  masteryStatus: MasteryStatus;
  summary: string;
  keyTakeaway: string;
  formulaOrRule?: string | null;
  children: MindNode[];
}

interface MindMapRecord {
  id: string;
  title: string;
  tree: MindNode;
}

interface LibraryItem {
  id: string;
  title: string;
  author?: string;
  category?: string;
  content?: string;
}

interface UserInfo {
  id: string;
  email: string;
  full_name?: string;
  username?: string;
}

interface AiMindMapPageProps {
  items?: LibraryItem[];
  token?: string | null;
  user?: UserInfo | null;
  apiFetch?: FeatureApiFetch;
  onSignIn?: () => void;
}

function collectNodes(node: MindNode): MindNode[] {
  if (!node) return [];
  const children = Array.isArray(node.children) ? node.children : [];
  return [node, ...children.flatMap(collectNodes)];
}

function createBookGroundedMindMap(
  item?: LibraryItem | null,
  fallbackDocId: string = "demo",
  fallbackTitle: string = "Document"
): MindMapRecord {
  const title = item?.title || fallbackTitle;
  const author = item?.author || "Classic Literature";
  const content = item?.content || "";
  const titleLower = title.toLowerCase();

  // 1. Great Expectations by Charles Dickens
  if (titleLower.includes("great expectations") || titleLower.includes("dickens")) {
    return {
      id: `map-${item?.id || fallbackDocId}`,
      title: "Great Expectations",
      tree: {
        id: "node-root",
        label: "Great Expectations · Charles Dickens",
        category: "central",
        priority: "high",
        masteryStatus: "in_progress",
        summary: "A Victorian Bildungsroman following the orphan Pip as he navigates social class, wealth, guilt, and moral redemption.",
        keyTakeaway: "True nobility and moral worth reside in integrity, affection, and personal loyalty—not social class or fortune.",
        children: [
          {
            id: "node-1",
            label: "1. Main Characters & Key Relationships",
            category: "theme",
            priority: "high",
            masteryStatus: "in_progress",
            summary: "Core character arcs and character dynamics driving Pip's development.",
            keyTakeaway: "Pip's perception of gentility shifts from aristocratic external status to genuine human kindness.",
            children: [
              {
                id: "node-1-1",
                label: "Pip (Philip Pirrip)",
                category: "concept",
                priority: "high",
                masteryStatus: "mastered",
                summary: "Protagonist who transitions from marshland village blacksmith apprentice to ambitious London gentleman, eventually realizing his moral errors.",
                keyTakeaway: "Learns that snobbery alienates those who truly love him, leading to genuine humility and self-awareness.",
                children: [],
              },
              {
                id: "node-1-2",
                label: "Miss Havisham & Estella",
                category: "concept",
                priority: "high",
                masteryStatus: "in_progress",
                summary: "Decaying mistress of Satis House who raises Estella as a heartless weapon against men following her tragic wedding day abandonment.",
                keyTakeaway: "Unforgiving vengeance corrodes Satis House and prevents true emotional connection.",
                children: [],
              },
              {
                id: "node-1-3",
                label: "Joe Gargery & Abel Magwitch",
                category: "action",
                priority: "high",
                masteryStatus: "mastered",
                summary: "Joe (the humble blacksmith who loves Pip unconditionally) and Magwitch (the escaped convict who secretly funds Pip's fortunes).",
                keyTakeaway: "The 'lowest' members of society demonstrate the highest moral nobility and sacrifice.",
                children: [],
              },
            ],
          },
          {
            id: "node-2",
            label: "2. Central Themes & Social Commentary",
            category: "theme",
            priority: "high",
            masteryStatus: "in_progress",
            summary: "Dickensian critiques of Victorian class structure, criminal justice, and moral corruption.",
            keyTakeaway: "Wealth without affection leads to alienation, debt, and shallow vanity.",
            formulaOrRule: "Quote: \"Take nothing on its looks; take everything on evidence. There's no better rule.\"",
            children: [
              {
                id: "node-2-1",
                label: "Social Class, Ambition & Wealth",
                category: "concept",
                priority: "high",
                masteryStatus: "in_progress",
                summary: "Pip's desperate desire to become a gentleman to win Estella's affection.",
                keyTakeaway: "Social mobility achieved by disowning humble roots brings guilt rather than happiness.",
                children: [],
              },
              {
                id: "node-2-2",
                label: "Crime, Guilt & Legal System",
                category: "concept",
                priority: "medium",
                masteryStatus: "to_learn",
                summary: "The shadow of Newgate Prison, Mr. Jaggers' legal cynicism, and Pip's recurring guilt starting from the marsh graveyard.",
                keyTakeaway: "The legal justice system treats humans mechanically, ignoring true moral intent.",
                children: [],
              },
            ],
          },
        ],
      },
    };
  }

  // 2. Thor #1 (2014) - Goddess of Thunder
  if (titleLower.includes("thor")) {
    return {
      id: `map-${item?.id || fallbackDocId}`,
      title: "Thor #1 (2014) · Goddess of Thunder",
      tree: {
        id: "node-root",
        label: "Thor #1 (2014) · Goddess of Thunder",
        category: "central",
        priority: "high",
        masteryStatus: "in_progress",
        summary: "Jason Aaron's seminal comic arc where the Odinson becomes unworthy and a mystery woman lifts Mjolnir.",
        keyTakeaway: "Heroism is defined by divine worthiness, selfless willingness to protect others, and personal sacrifice.",
        children: [
          {
            id: "node-1",
            label: "1. Principal Characters & Asgardian Pantheon",
            category: "theme",
            priority: "high",
            masteryStatus: "mastered",
            summary: "Key players across Earth, Asgard, and the Realm of the Gods.",
            keyTakeaway: "Changing of the guard in Asgardian leadership and the hammer's choice.",
            children: [
              {
                id: "node-1-1",
                label: "The Goddess of Thunder (Jane Foster)",
                category: "concept",
                priority: "high",
                masteryStatus: "mastered",
                summary: "Secretly Jane Foster, who proves worthy to lift Mjolnir on the Moon when no God can.",
                keyTakeaway: "Her human compassion and courage transcend divine entitlement.",
                children: [],
              },
              {
                id: "node-1-2",
                label: "The Unworthy Odinson",
                category: "concept",
                priority: "high",
                masteryStatus: "mastered",
                summary: "Thor Odinson loses the ability to lift Mjolnir following Gorr's whispered secrets.",
                keyTakeaway: "Losing worthiness forces Thor to confront his identity without his hammer.",
                children: [],
              },
            ],
          },
        ],
      },
    };
  }

  // Generic book fallback
  return {
    id: `map-${item?.id || fallbackDocId}`,
    title,
    tree: {
      id: "node-root",
      label: `${title} · Core Concept Map`,
      category: "central",
      priority: "high",
      masteryStatus: "in_progress",
      summary: `AI concept map and key learning pathway for "${title}".`,
      keyTakeaway: "Foundational principles, core theorems, and practical applications extracted from book.",
      children: [
        {
          id: "node-1",
          label: "1. Core Foundations & Domain Terms",
          category: "theme",
          priority: "high",
          masteryStatus: "in_progress",
          summary: "Essential domain definitions, scope boundaries, and fundamental terminology.",
          keyTakeaway: "Mastering foundational terminology creates the baseline for complex analysis.",
          formulaOrRule: "Principle #1: Foundational Structure",
          children: [
            {
              id: "node-1-1",
              label: "Primary Definitions & Concepts",
              category: "concept",
              priority: "high",
              masteryStatus: "mastered",
              summary: `Primary terms and domain vocabulary used throughout ${title}.`,
              keyTakeaway: "Precise terminology avoids ambiguity in analytical reasoning.",
              children: [],
            },
            {
              id: "node-1-2",
              label: "Key Arguments & Assumptions",
              category: "action",
              priority: "high",
              masteryStatus: "to_learn",
              summary: "Underlying assumptions and baseline conditions.",
              keyTakeaway: "Assumptions set the scope within which theoretical claims remain valid.",
              children: [],
            },
          ],
        },
      ],
    },
  };
}

function MindMapBranch({
  node,
  selectedId,
  onSelect,
}: {
  node: MindNode;
  selectedId: string | null;
  onSelect: (node: MindNode) => void;
}) {
  return (
    <li className="space-y-2">
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={`w-full rounded-2xl border p-4 text-left transition-all ${
          selectedId === node.id
            ? "border-emerald-500 bg-emerald-950/40 text-neutral-100 shadow-lg shadow-emerald-500/10"
            : "border-neutral-800 bg-neutral-900/80 text-neutral-300 hover:border-neutral-700"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="block font-bold text-sm text-neutral-100">{node.label}</span>
            <span className="block text-xs text-neutral-400 leading-relaxed">{node.summary}</span>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              node.masteryStatus === "mastered"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : node.masteryStatus === "in_progress"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-neutral-800 text-neutral-400 border border-neutral-700"
            }`}
          >
            {node.masteryStatus.replace("_", " ")}
          </span>
        </div>
      </button>

      {node.children.length > 0 && (
        <ul className="ml-4 space-y-2 border-l-2 border-emerald-900/50 pl-4 sm:ml-6 sm:pl-6">
          {node.children.map((child) => (
            <MindMapBranch
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function AiMindMapPage({ items = [], token, user, apiFetch, onSignIn }: AiMindMapPageProps) {
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [uploadedDocument, setUploadedDocument] = useState<LibraryItem | null>(null);
  const [mindMap, setMindMap] = useState<MindMapRecord | null>(null);
  const [selectedNode, setSelectedNode] = useState<MindNode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [fileError, setFileError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [generationNotice, setGenerationNotice] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100);

  const authenticated = useMemo(() => {
    if (user && (user.id || user.email)) return true;
    if (token && token.trim().length > 0) return true;
    return hasCloudSession(token);
  }, [user, token]);

  const activeDoc = useMemo(() => {
    if (uploadedDocument?.id === selectedDocId) return uploadedDocument;
    return items.find((item) => item.id === selectedDocId);
  }, [items, selectedDocId, uploadedDocument]);

  const nodes = useMemo(() => (mindMap ? collectNodes(mindMap.tree) : []), [mindMap]);
  const masteredCount = nodes.filter((node) => node.masteryStatus === "mastered").length;
  const inProgressCount = nodes.filter((node) => node.masteryStatus === "in_progress").length;
  const progress = nodes.length ? Math.round((masteredCount / nodes.length) * 100) : 0;

  useEffect(() => {
    if (selectedDocId && activeDoc) return;
    if (items.length > 0) {
      setSelectedDocId(items[0].id);
    } else if (selectedDocId) {
      setSelectedDocId("");
    }
  }, [activeDoc, items, selectedDocId]);

  const handleDirectFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setFileError("");
    setGenerationError("");
    setGenerationNotice("");
    setMindMap(null);
    setSelectedNode(null);
    setUploadedDocument(null);
    setIsReadingFile(true);
    try {
      const content = await extractCitationDocumentText(file);
      const document: LibraryItem = {
        id: `uploaded-${Date.now()}`,
        title: file.name,
        author: "Uploaded document",
        content,
      };
      setUploadedDocument(document);
      setSelectedDocId(document.id);
    } catch (error) {
      setFileError(getErrorMessage(error, "Unable to read the selected file."));
    } finally {
      setIsReadingFile(false);
    }
  };

  const generateMindMap = async () => {
    if (!activeDoc) {
      setGenerationError("Choose a library document or upload a file first.");
      return;
    }

    const documentText = activeDoc.content?.trim() || "";
    setIsGenerating(true);
    setGenerationError("");
    setGenerationNotice("");
    try {
      let map: MindMapRecord | null = null;
      const isLocalDocument =
        activeDoc.id.startsWith("local-") ||
        activeDoc.id.startsWith("uploaded-") ||
        activeDoc.id.startsWith("downloaded-");

      if (apiFetch && token && !token.startsWith("local-token-") && !isLocalDocument) {
        try {
          const response = await apiFetch<MindMapRecord>(
            "/ai/mind-maps",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ library_item_id: activeDoc.id }),
            },
            token,
          );
          if (!isMindMapRecord(response)) {
            throw new Error("The AI service returned an invalid mind map.");
          }
          map = response;
        } catch (error) {
          if (!documentText) throw error;
          setGenerationNotice(
            `Cloud AI is unavailable (${getErrorMessage(error, "request failed")}). Showing key points extracted from the document text instead.`,
          );
        }
      }

      if (!map) {
        if (!documentText) {
          throw new Error(
            "No extracted text is available for this document. Re-import it or upload a readable PDF, DOCX, TXT, Markdown, TeX, or BibTeX file.",
          );
        }
        map = createExtractiveMindMap({
          id: activeDoc.id,
          title: activeDoc.title,
          content: documentText,
        });
      }

      setMindMap(map);
      setSelectedNode(map.tree);
    } catch (error) {
      setGenerationError(getErrorMessage(error, "Unable to generate a mind map."));
    } finally {
      setIsGenerating(false);
    }
  };

  const updateMastery = (node: MindNode, masteryStatus: MasteryStatus) => {
    if (!mindMap) return;

    const updateRecursive = (curr: MindNode): MindNode => {
      if (curr.id === node.id) {
        return { ...curr, masteryStatus };
      }
      return { ...curr, children: curr.children.map(updateRecursive) };
    };

    const updatedTree = updateRecursive(mindMap.tree);
    const updatedRecord = { ...mindMap, tree: updatedTree };
    setMindMap(updatedRecord);
    setSelectedNode(collectNodes(updatedTree).find((item) => item.id === node.id) ?? null);
  };

  return (
    <div className="clio-feature-page space-y-6 pb-12 text-neutral-100 max-w-5xl mx-auto px-4">
      {/* Hero Header */}
      <header className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-teal-950/20 to-neutral-950 p-6 md:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute -right-8 -top-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              AI Concept Discovery & Learning Areas
            </div>

            {authenticated ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-800/60 bg-emerald-950/60 text-xs font-medium text-emerald-300">
                <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                Account Active
              </span>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="text-xs text-neutral-300 underline hover:text-white"
              >
                Sign in
              </button>
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-neutral-100 md:text-3xl tracking-tight">
            AI Mind Map & Key Learning Areas
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-neutral-300">
            Automatically extract concept hierarchies, core theorems, prerequisites, and key learning pathways from any document in your CLIO library.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <select
              value={selectedDocId}
              disabled={isGenerating || isReadingFile}
              onChange={(event) => {
                setSelectedDocId(event.target.value);
                setMindMap(null);
                setSelectedNode(null);
                setGenerationError("");
                setGenerationNotice("");
              }}
              className="max-w-full rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-100 focus:border-emerald-500 focus:outline-none"
              aria-label="Choose a library document"
            >
              <option value="">Choose a document</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
              {uploadedDocument && (
                <option value={uploadedDocument.id}>{uploadedDocument.title} (uploaded)</option>
              )}
            </select>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800">
              <Upload className="h-4 w-4" />
              {isReadingFile ? "Reading file…" : "Upload file"}
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,.tex,.bib"
                onChange={handleDirectFileUpload}
                disabled={isReadingFile || isGenerating}
                className="sr-only"
              />
            </label>

            <button
              type="button"
              onClick={generateMindMap}
              disabled={isGenerating || isReadingFile || !activeDoc}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              {isGenerating ? "Generating Mind Map…" : "Generate Mind Map"}
            </button>
          </div>
          {fileError && <p role="alert" className="text-sm font-medium text-rose-400">{fileError}</p>}
          {generationError && (
            <p role="alert" className="text-sm font-medium text-rose-400">{generationError}</p>
          )}
          {generationNotice && (
            <p role="status" className="text-sm text-amber-400">{generationNotice}</p>
          )}
          {uploadedDocument?.id === selectedDocId && (
            <p role="status" className="text-xs text-neutral-400">
              {uploadedDocument.title} is loaded for this mind map only. Import it to your library to keep it.
            </p>
          )}
        </div>
      </header>

      {/* Progress & Stat Cards */}
      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 space-y-2 shadow-lg">
          <p className="text-xs text-neutral-400 font-medium">Mastery Progress</p>
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-extrabold text-emerald-400">{progress}%</p>
            <span className="text-xs text-neutral-400">
              {masteredCount} of {nodes.length} concepts
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 space-y-1 shadow-lg">
          <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Mastered Concepts
          </p>
          <p className="text-3xl font-extrabold text-neutral-100">{masteredCount}</p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 space-y-1 shadow-lg">
          <p className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            In Progress
          </p>
          <p className="text-3xl font-extrabold text-neutral-100">{inProgressCount}</p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 space-y-1 shadow-lg">
          <p className="text-xs text-neutral-400 font-medium flex items-center gap-1.5">
            <Target className="w-4 h-4 text-indigo-400" />
            To Learn
          </p>
          <p className="text-3xl font-extrabold text-neutral-100">
            {nodes.length - masteredCount - inProgressCount}
          </p>
        </div>
      </section>

      {!mindMap && (
        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/90 p-8 text-center shadow-xl">
          <FileText className="mx-auto mb-3 h-8 w-8 text-emerald-400" />
          <h2 className="text-base font-bold text-neutral-100">Start with your document</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-400">
            Choose a library document or upload a text-readable file. CLIO will build key points from
            its extracted text instead of showing a sample map.
          </p>
        </section>
      )}

      {/* Main Concept Tree & Node Inspector Workspace */}
      {mindMap && (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
          {/* Concept Tree Column */}
          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/90 p-5 sm:p-7 space-y-5 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <Network className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-neutral-100">Interactive Concept Tree</h2>
              </div>

              <div className="flex items-center gap-2 bg-neutral-950 px-3 py-1.5 rounded-2xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
                  className="p-1 text-neutral-400 hover:text-neutral-100 transition-colors"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs font-bold text-neutral-300">{zoomLevel}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                  className="p-1 text-neutral-400 hover:text-neutral-100 transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              className="space-y-4 overflow-x-auto p-1 transition-transform origin-top-left"
              style={{ transform: `scale(${zoomLevel / 100})` }}
            >
              <ul className="space-y-3">
                <MindMapBranch
                  node={mindMap.tree}
                  selectedId={selectedNode?.id ?? null}
                  onSelect={setSelectedNode}
                />
              </ul>
            </div>
          </div>

          {/* Node Detail Inspector Sidebar */}
          <aside className="rounded-3xl border border-neutral-800 bg-neutral-900/90 p-6 space-y-5 shadow-2xl">
            <div className="pb-4 border-b border-neutral-800">
              <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                Concept Inspector & Mastery
              </h2>
            </div>

            {selectedNode ? (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">
                    {selectedNode.category} Node
                  </span>
                  <h3 className="text-lg font-extrabold text-neutral-100 leading-snug">
                    {selectedNode.label}
                  </h3>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1.5">
                  <div className="text-xs font-semibold text-neutral-300">Overview & Context:</div>
                  <p className="text-xs text-neutral-400 leading-relaxed">{selectedNode.summary}</p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-900/40 space-y-1.5">
                  <div className="text-xs font-semibold text-emerald-300">Core Takeaway:</div>
                  <p className="text-xs text-emerald-200/90 leading-relaxed">{selectedNode.keyTakeaway}</p>
                </div>

                {selectedNode.formulaOrRule && (
                  <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1.5">
                    <div className="text-xs font-semibold text-neutral-300">Key Formula / Definition:</div>
                    <pre className="font-mono text-xs text-emerald-400 bg-neutral-900 p-3 rounded-xl border border-neutral-800 overflow-x-auto">
                      {selectedNode.formulaOrRule}
                    </pre>
                  </div>
                )}

                {/* Mastery Status Selector */}
                <div className="space-y-2.5 pt-3 border-t border-neutral-800">
                  <p className="text-xs font-semibold text-neutral-300">Update Mastery Status:</p>
                  <div className="space-y-2">
                    {(["to_learn", "in_progress", "mastered"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateMastery(selectedNode, value)}
                        className={`flex w-full items-center justify-between rounded-2xl border p-3 text-xs font-medium capitalize transition-all ${
                          selectedNode.masteryStatus === value
                            ? "border-emerald-500 bg-emerald-950/60 text-emerald-200 shadow-md shadow-emerald-500/10"
                            : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {selectedNode.masteryStatus === value ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Circle className="h-4 w-4 text-neutral-600" />
                          )}
                          {value.replace("_", " ")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500 text-center py-8">
                Click any node in the concept tree to inspect details and update mastery.
              </p>
            )}
          </aside>
        </section>
      )}
    </div>
  );
}
