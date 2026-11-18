import { unzipSync } from "fflate";
import { useEffect, useState } from "react";
import { extensionOf } from "./kinds";

const MAX_TOTAL_XML = 20 * 1024 * 1024;
const MAX_PART_XML = 8 * 1024 * 1024;
const MAX_OUTPUT_CHARACTERS = 250_000;

export type OfficeDocument = {
  sections: { heading: string; lines: string[] }[];
  truncated: boolean;
};

/**
 * Read-only text extraction from OOXML documents. XML is parsed as inert data; the browser never
 * executes embedded macros, hyperlinks, document HTML or external resources. Skip every ZIP entry
 * except bounded, known document parts, before decompressing it.
 */
export function extractOfficeDocument(bytes: Uint8Array, extension: string): OfficeDocument {
  if (bytes.byteLength > 12 * 1024 * 1024) throw new Error("Document is too large to preview");
  let total = 0;
  const want = (name: string): boolean => {
    if (extension === "docx") return name === "word/document.xml";
    if (extension === "pptx") return /^ppt\/slides\/slide[0-9]+\.xml$/u.test(name);
    return (
      extension === "xlsx" &&
      (name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet[0-9]+\.xml$/u.test(name))
    );
  };
  const entries = unzipSync(bytes, {
    filter: (file) => {
      if (
        !want(file.name) ||
        file.originalSize > MAX_PART_XML ||
        total + file.originalSize > MAX_TOTAL_XML
      )
        return false;
      total += file.originalSize;
      return true;
    },
  });
  const parser = new DOMParser();
  const read = (name: string): Document | null => {
    const encoded = entries[name];
    if (!encoded) return null;
    const xml = parser.parseFromString(new TextDecoder().decode(encoded), "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("Document contains invalid XML");
    return xml;
  };
  const sections: OfficeDocument["sections"] = [];
  const namespaces = {
    word: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    drawing: "http://schemas.openxmlformats.org/drawingml/2006/main",
    sheet: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  };
  const parts = Object.keys(entries)
    .filter((name) => name !== "xl/sharedStrings.xml")
    .sort(
      (a, b) =>
        Number(a.match(/\d+(?=\.xml$)/u)?.[0] ?? 0) - Number(b.match(/\d+(?=\.xml$)/u)?.[0] ?? 0),
    );
  const sharedXml = read("xl/sharedStrings.xml");
  const shared = sharedXml
    ? [...sharedXml.getElementsByTagNameNS(namespaces.sheet, "si")].map((node) =>
        [...node.getElementsByTagNameNS(namespaces.sheet, "t")]
          .map((text) => text.textContent ?? "")
          .join(""),
      )
    : [];
  for (const part of parts.slice(0, 100)) {
    const doc = read(part);
    if (!doc) continue;
    const lines: string[] = [];
    if (extension === "docx" || extension === "pptx") {
      const ns = extension === "docx" ? namespaces.word : namespaces.drawing;
      const paragraphTag = "p";
      for (const paragraph of doc.getElementsByTagNameNS(ns, paragraphTag)) {
        const text = [...paragraph.getElementsByTagNameNS(ns, "t")]
          .map((x) => x.textContent ?? "")
          .join("");
        if (text.trim()) lines.push(text);
      }
    } else {
      for (const row of doc.getElementsByTagNameNS(namespaces.sheet, "row")) {
        const cells: string[] = [];
        for (const cell of row.getElementsByTagNameNS(namespaces.sheet, "c")) {
          const value = cell.getElementsByTagNameNS(namespaces.sheet, "v")[0]?.textContent ?? "";
          const inline = cell.getElementsByTagNameNS(namespaces.sheet, "is")[0]?.textContent ?? "";
          cells.push(
            cell.getAttribute("t") === "s" ? (shared[Number(value)] ?? "") : inline || value,
          );
        }
        if (cells.length) lines.push(cells.join("  |  "));
      }
    }
    sections.push({
      heading:
        extension === "docx" ? "Document" : (part.split("/").at(-1)?.replace(".xml", "") ?? "Page"),
      lines,
    });
  }
  if (!sections.length) throw new Error("No supported document text was found");
  let characters = 0;
  let truncated = parts.length > 100;
  for (const section of sections) {
    const kept: string[] = [];
    for (const line of section.lines) {
      if (characters + line.length > MAX_OUTPUT_CHARACTERS) {
        truncated = true;
        break;
      }
      characters += line.length;
      kept.push(line);
    }
    section.lines = kept;
  }
  return { sections, truncated };
}

export function OfficeView({ blob, path }: { blob: Blob; path: string }): React.JSX.Element {
  const [document, setDocument] = useState<OfficeDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void blob
      .arrayBuffer()
      .then((buffer) => extractOfficeDocument(new Uint8Array(buffer), extensionOf(path)))
      .then((result) => {
        if (active) setDocument(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to preview document");
      });
    return () => {
      active = false;
    };
  }, [blob, path]);
  if (error)
    return (
      <div className="content-state error-state" role="alert">
        {error}. You can still download the original.
      </div>
    );
  if (!document)
    return (
      <div className="content-state" role="status">
        Reading document…
      </div>
    );
  return (
    <article className="office-view">
      <p className="preview-notice">
        Read-only text preview. Complex formatting, charts, images, and formulas may not appear.
        Download the original for full fidelity.
      </p>
      {document.sections.map((section) => (
        <section key={section.heading} className="office-section">
          <h2>{section.heading}</h2>
          {section.lines.length ? (
            section.lines.map((line, lineIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: document lines are immutable within this preview.
              <p key={lineIndex}>{line}</p>
            ))
          ) : (
            <p>No readable text.</p>
          )}
        </section>
      ))}
      {document.truncated ? (
        <p className="preview-notice">Preview truncated for performance and safety.</p>
      ) : null}
    </article>
  );
}
