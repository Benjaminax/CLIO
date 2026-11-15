export interface ExtractedReference {
  id: string;
  index: number;
  rawText: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string;
  status: "unverified";
  confidenceScore: number;
  databaseMatch?: string;
}

export interface ExtractedDefect {
  type: "gap" | "out_of_order" | "uncited" | "range_error";
  severity: "high" | "medium" | "low";
  marker?: string;
  description: string;
  suggestion: string;
}

function getBibliographySection(text: string): string {
  const latexStart = /\\begin\{thebibliography\}(?:\[[^\]]*\])?\{[^}]*\}/i.exec(text);
  if (latexStart) {
    const bodyStart = latexStart.index + latexStart[0].length;
    const section = text.slice(bodyStart);
    const end = section.indexOf("\\end{thebibliography}");
    return end >= 0 ? section.slice(0, end) : section;
  }

  const heading = /^\s*(?:references|bibliography|works cited|literature cited)\s*$/im.exec(text);
  return heading ? text.slice(heading.index + heading[0].length) : text;
}

function createReference(
  rawText: string,
  index: number,
  title: string,
  authors: string[],
  year: number | null,
  venue = "",
): ExtractedReference {
  return {
    id: `uploaded-ref-${index}`,
    index,
    rawText: rawText.trim(),
    title: title.trim() || `Reference ${index}`,
    authors,
    year,
    venue,
    status: "unverified",
    confidenceScore: 0,
  };
}

function parseBibtex(text: string): ExtractedReference[] {
  const entries = text.match(/@\w+\s*[{(][\s\S]*?(?=\s*@\w+\s*[{(]|$)/g) || [];
  return entries.map((rawText, entryIndex) => {
    const index = entryIndex + 1;
    const readField = (field: string) => {
      const match = new RegExp(`${field}\\s*=\\s*(?:\\{([^}]*)\\}|"([^"]*)"|([^,\\n]+))`, "i").exec(
        rawText,
      );
      return match?.slice(1).find(Boolean)?.replace(/[{}]/g, "").trim() || "";
    };
    const year = readField("year").match(/\d{4}/)?.[0];
    return createReference(
      rawText,
      index,
      readField("title") || `BibTeX entry ${index}`,
      readField("author")
        .split(/\s+and\s+/i)
        .map((author) => author.trim())
        .filter(Boolean),
      year ? Number(year) : null,
      readField("journal") || readField("booktitle"),
    );
  });
}

function startsReference(line: string): boolean {
  if (/^(?:\[\d+\]|\d+[.)])\s*/.test(line)) return true;
  return (
    /^[A-Z][A-Za-z'’-]+(?:,|\s+(?:et\s+al\.|and\b|&))/.test(line) && /\b(?:19|20)\d{2}\b/.test(line)
  );
}

function parsePlainReferences(text: string): ExtractedReference[] {
  let section = getBibliographySection(text);
  let bibitemIndex = 0;
  section = section.replace(/\\bibitem(?:\[[^\]]*\])?\{[^}]*\}/g, () => {
    bibitemIndex += 1;
    return `\n${bibitemIndex}. `;
  });

  const entries: string[] = [];
  let current = "";
  for (const line of section
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)) {
    if (startsReference(line) && current) {
      entries.push(current);
      current = line;
    } else {
      current = current ? `${current} ${line}` : line;
    }
  }
  if (current) entries.push(current);

  return entries.map((rawText, entryIndex) => {
    const ordinal = entryIndex + 1;
    const marker = /^\s*(?:\[(\d+)\]|(\d+)[.)])\s*/.exec(rawText);
    const index = Number(marker?.[1] || marker?.[2] || ordinal);
    const yearMatch = /\b((?:19|20)\d{2})[a-z]?\b/.exec(rawText);
    const year = yearMatch ? Number(yearMatch[1]) : null;
    const title = yearMatch
      ? rawText
          .slice(yearMatch.index + yearMatch[0].length)
          .replace(/^[\s.)-]+/, "")
          .split(/\.\s+(?=[A-Z])/)[0]
          .replace(/[.]$/, "")
      : "";
    const authors = yearMatch
      ? rawText
          .slice(0, yearMatch.index)
          .replace(/^\s*(?:\[\d+\]|\d+[.)])\s*/, "")
          .replace(/[\s(]+$/, "")
          .split(/,\s*(?=[A-Z])|\s+&\s+|\s+and\s+/i)
          .map((author) => author.trim())
          .filter(Boolean)
      : [];
    return createReference(rawText, index, title, authors, year);
  });
}

export function extractReferences(text: string): ExtractedReference[] {
  const bibtexReferences = parseBibtex(text);
  return bibtexReferences.length ? bibtexReferences : parsePlainReferences(text);
}

export function analyzeInlineCitations(
  text: string,
  references: ExtractedReference[],
): ExtractedDefect[] {
  const latexStart = /\\begin\{thebibliography\}/i.exec(text);
  const heading = /^\s*(?:references|bibliography|works cited|literature cited)\s*$/im.exec(text);
  const body = latexStart
    ? text.slice(0, latexStart.index)
    : heading
      ? text.slice(0, heading.index)
      : text;
  const defects: ExtractedDefect[] = [];
  const cited = new Set<number>();
  const firstMentions: number[] = [];
  const citationPattern = /\[(\d+(?:\s*(?:,|-)\s*\d+)*)\]/g;

  for (const match of body.matchAll(citationPattern)) {
    for (const token of (match[1] || "").split(",")) {
      const range = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(token);
      if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        if (start > end) {
          defects.push({
            type: "range_error",
            severity: "high",
            marker: `[${start}-${end}]`,
            description: `Inverted numeric citation range [${start}-${end}] found in the paper body.`,
            suggestion: `Reverse the range to [${end}-${start}] if that range is intended.`,
          });
          continue;
        }
        for (let number = start; number <= Math.min(end, start + 100); number++) {
          if (!cited.has(number)) firstMentions.push(number);
          cited.add(number);
        }
      } else {
        const number = Number(token.trim());
        if (!number) continue;
        if (!cited.has(number)) firstMentions.push(number);
        cited.add(number);
      }
    }
  }

  if (!cited.size) return defects;

  const numbers = [...cited].sort((left, right) => left - right);
  const missing: number[] = [];
  let missingCount = 0;
  for (let index = 1; index < numbers.length; index += 1) {
    const previous = numbers[index - 1];
    const current = numbers[index];
    missingCount += current - previous - 1;
    for (let number = previous + 1; number < current && missing.length < 100; number += 1) {
      missing.push(number);
    }
  }
  if (missingCount) {
    const missingLabel = missing.join(", ");
    const remaining = missingCount - missing.length;
    defects.push({
      type: "gap",
      severity: "medium",
      description: `Numeric citation sequence skips reference${missingCount > 1 ? "s" : ""} ${missingLabel}${remaining ? ` and ${remaining} more` : ""}.`,
      suggestion: "Check whether the missing references were omitted or renumbered.",
    });
  }

  let previousMention = 0;
  const outOfOrder = firstMentions.find((number) => {
    const isOutOfOrder = number < previousMention;
    previousMention = number;
    return isOutOfOrder;
  });
  if (outOfOrder !== undefined) {
    defects.push({
      type: "out_of_order",
      severity: "low",
      marker: `[${outOfOrder}]`,
      description: "A numeric reference is first cited out of ascending order.",
      suggestion: "Confirm the reference numbering matches first-mention order.",
    });
  }

  const uncited = references.filter((reference) => !cited.has(reference.index));
  if (uncited.length) {
    defects.push({
      type: "uncited",
      severity: "medium",
      description: `${uncited.length} bibliography reference${uncited.length === 1 ? " is" : "s are"} not cited in the paper body.`,
      suggestion: "Cite the reference in the body or remove it from the bibliography.",
    });
  }

  return defects;
}
