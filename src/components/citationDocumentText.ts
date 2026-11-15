import { strFromU8, unzipSync } from "fflate";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function extractDocxText(data: Uint8Array): string {
  const documentXml = unzipSync(data)["word/document.xml"];
  if (!documentXml) throw new Error("This DOCX file is missing its document content.");

  const parsed = new DOMParser().parseFromString(strFromU8(documentXml), "application/xml");
  if (parsed.querySelector("parsererror")) throw new Error("This DOCX file is invalid or damaged.");

  return Array.from(parsed.getElementsByTagNameNS("*", "p"))
    .map((paragraph) =>
      Array.from(paragraph.getElementsByTagNameNS("*", "t"))
        .map((text) => text.textContent || "")
        .join(""),
    )
    .filter(Boolean)
    .join("\n");
}

async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });

  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let lastY: number | undefined;

      const textItems = content.items.filter((item): item is TextItem => "str" in item);
      for (const textItem of textItems) {
        const y = textItem.transform[5];
        if (lastY !== undefined && Math.abs(lastY - y) > 2) lines.push("\n");
        else if (lines.length > 0 && !lines[lines.length - 1].endsWith("\n")) lines.push(" ");
        lines.push(textItem.str);
        lastY = y;
      }

      pages.push(lines.join(""));
    }

    const text = pages.join("\n\n").trim();
    if (!text) {
      throw new Error(
        "No selectable text was found. Scanned PDFs need OCR before RefChecker can analyze them.",
      );
    }
    return text;
  } finally {
    await loadingTask.destroy();
  }
}

export async function extractCitationDocumentText(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("The file is larger than the 50 MB upload limit.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["pdf", "docx", "txt", "md", "tex", "bib"].includes(extension)) {
    throw new Error("Choose a PDF, DOCX, TXT, Markdown, TeX, or BibTeX file.");
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const text =
    extension === "pdf"
      ? await extractPdfText(data)
      : extension === "docx"
        ? extractDocxText(data)
        : new TextDecoder().decode(data);

  if (!text.trim()) throw new Error("This file contains no readable text.");
  return text;
}
