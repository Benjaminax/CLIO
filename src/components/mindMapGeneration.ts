export type MindMapCategory = "central" | "theme" | "concept" | "action";
export type MindMapPriority = "high" | "medium" | "low";
export type MasteryStatus = "to_learn" | "in_progress" | "mastered";

export interface MindNode {
  id: string;
  label: string;
  category: MindMapCategory;
  priority: MindMapPriority;
  masteryStatus: MasteryStatus;
  summary: string;
  keyTakeaway: string;
  formulaOrRule?: string | null;
  children: MindNode[];
}

export interface MindMapRecord {
  id: string;
  title: string;
  tree: MindNode;
}

export interface MindMapSource {
  id: string;
  title: string;
  content: string;
}

const STOP_WORDS = new Set(
  (
    "about after again against also although among another any are because been before being " +
    "between both could did does doing during each few for from further had has have having " +
    "here hers himself into itself just more most other our out over same should some such " +
    "than that the their theirs them themselves then there these they this those through " +
    "under until very was were what when where which while who whom why will with would " +
    "your yourself document page figure table section chapter study paper result results " +
    "using used based"
  ).split(/\s+/),
);

function getWords(sentence: string): string[] {
  return (sentence.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter(
    (word) => !STOP_WORDS.has(word),
  );
}

function getDocumentSample(content: string): string {
  const maxCharacters = 1_000_000;
  if (content.length <= maxCharacters) return content;

  const sectionSize = Math.floor(maxCharacters / 5);
  return Array.from({ length: 5 }, (_, index) => {
    const start = Math.floor((content.length - sectionSize) * (index / 4));
    return content.slice(start, start + sectionSize);
  }).join("\n");
}

function sentenceLabel(sentence: string): string {
  const firstClause = sentence.split(/[;:!?]/, 1)[0].trim();
  const label = firstClause.length >= 18
    ? firstClause
    : sentence.split(/\s+/).slice(0, 8).join(" ");
  return label.length > 64 ? `${label.slice(0, 61).trimEnd()}...` : label;
}

export function createExtractiveMindMap(source: MindMapSource): MindMapRecord {
  const text = getDocumentSample(source.content)
    .replace(/---\s*Page\s+\d+[^-\r\n]*---/gi, "\n")
    .replace(/\u00ad/g, "")
    .trim();

  const fragments = text
    .split(/(?<=[.!?])\s+|\r?\n+/u)
    .map((fragment) => fragment.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let candidates = fragments.filter(
    (sentence) => sentence.length >= 30 && getWords(sentence).length >= 5,
  );
  if (candidates.length === 0) {
    candidates = fragments.filter(
      (sentence) => sentence.length >= 16 && getWords(sentence).length >= 3,
    );
  }
  if (candidates.length === 0) {
    throw new Error("This document does not contain enough readable text to make key points.");
  }

  const frequencies = new Map<string, number>();
  const tokensBySentence = candidates.map((sentence) => {
    const words = getWords(sentence);
    for (const word of new Set(words)) {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    }
    return new Set(words);
  });

  const ranked = candidates
    .map((sentence, index) => {
      const words = [...tokensBySentence[index]];
      const termScore = words.reduce(
        (score, word) => score + Math.log1p(frequencies.get(word) || 0),
        0,
      );
      return {
        sentence,
        tokens: tokensBySentence[index],
        index,
        score: termScore / Math.sqrt(Math.max(words.length, 1)) + 0.2 / Math.sqrt(index + 1),
      };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const selected: typeof ranked = [];
  for (const candidate of ranked) {
    const duplicatesPoint = selected.some((point) => {
      let overlap = 0;
      for (const token of candidate.tokens) {
        if (point.tokens.has(token)) overlap += 1;
      }
      return overlap / Math.max(1, Math.min(candidate.tokens.size, point.tokens.size)) > 0.8;
    });
    if (!duplicatesPoint) selected.push(candidate);
    if (selected.length === 5) break;
  }

  const children: MindNode[] = selected.map(({ sentence }, index) => ({
    id: `${source.id}-key-point-${index + 1}`,
    label: `Key point ${index + 1}: ${sentenceLabel(sentence)}`,
    category: "concept",
    priority: index < 2 ? "high" : "medium",
    masteryStatus: "to_learn",
    summary: sentence,
    keyTakeaway: sentence,
    children: [],
  }));
  const topTakeaway = children[0]?.keyTakeaway || "";

  return {
    id: `map-${source.id}`,
    title: source.title,
    tree: {
      id: `${source.id}-root`,
      label: source.title,
      category: "central",
      priority: "high",
      masteryStatus: "in_progress",
      summary: `Key points extracted from the text of ${source.title}.`,
      keyTakeaway: topTakeaway,
      children,
    },
  };
}

export function isMindMapRecord(value: unknown): value is MindMapRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.title !== "string" ||
    typeof record.tree !== "object" ||
    record.tree === null
  ) {
    return false;
  }

  let nodeCount = 0;
  const isValidNode = (nodeValue: unknown, depth: number): nodeValue is MindNode => {
    if (typeof nodeValue !== "object" || nodeValue === null || depth > 3) return false;
    nodeCount += 1;
    if (nodeCount > 30) return false;

    const node = nodeValue as Record<string, unknown>;
    const validCategories = ["central", "theme", "concept", "action"];
    const validPriorities = ["high", "medium", "low"];
    const validMasteryStatuses = ["to_learn", "in_progress", "mastered"];
    return (
      typeof node.id === "string" &&
      typeof node.label === "string" &&
      validCategories.includes(String(node.category)) &&
      validPriorities.includes(String(node.priority)) &&
      validMasteryStatuses.includes(String(node.masteryStatus)) &&
      typeof node.summary === "string" &&
      typeof node.keyTakeaway === "string" &&
      (node.formulaOrRule === undefined ||
        node.formulaOrRule === null ||
        typeof node.formulaOrRule === "string") &&
      Array.isArray(node.children) &&
      node.children.every((child) => isValidNode(child, depth + 1))
    );
  };

  return isValidNode(record.tree, 1);
}
