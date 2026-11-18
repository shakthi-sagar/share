import { unzipSync } from "fflate";
import { useEffect, useState } from "react";
import { extensionOf } from "./kinds";
import {
  type Paragraph,
  type Slide,
  sheets,
  slides,
  type WordBlock,
  wordBlocks,
} from "./office-layout";
import { type Sheet, SpreadsheetView } from "./SpreadsheetView";

const MAX_TOTAL_XML = 20 * 1024 * 1024;
const MAX_PART_XML = 8 * 1024 * 1024;

type OfficeDocument =
  | { kind: "docx"; blocks: WordBlock[] }
  | { kind: "pptx"; pages: Slide[] }
  | { kind: "xlsx"; sheets: Sheet[] };

function openOffice(bytes: Uint8Array, extension: string): OfficeDocument {
  if (bytes.byteLength > 12 * 1024 * 1024) throw new Error("Document is too large to preview");
  let total = 0;
  const slidePattern = /^ppt\/slides\/slide[0-9]+\.xml$/u;
  const sheetPattern = /^xl\/worksheets\/sheet[0-9]+\.xml$/u;
  const want = (name: string): boolean => {
    if (extension === "docx") return name === "word/document.xml";
    if (extension === "pptx") return name === "ppt/presentation.xml" || slidePattern.test(name);
    return (
      ["xl/sharedStrings.xml", "xl/workbook.xml", "xl/_rels/workbook.xml.rels"].includes(name) ||
      sheetPattern.test(name)
    );
  };
  const entries = unzipSync(bytes, {
    filter(file) {
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
    if (!Object.hasOwn(entries, name)) return null;
    const encoded = entries[name];
    if (!encoded) return null;
    const xml = parser.parseFromString(new TextDecoder().decode(encoded), "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("Document contains invalid XML");
    return xml;
  };
  const parts = (pattern: RegExp) =>
    Object.keys(entries)
      .filter((name) => pattern.test(name))
      .sort(
        (a, b) => Number(a.match(/\d+(?=\.xml$)/u)?.[0]) - Number(b.match(/\d+(?=\.xml$)/u)?.[0]),
      );
  if (extension === "docx") return { kind: "docx", blocks: wordBlocks(read) };
  if (extension === "pptx") return { kind: "pptx", pages: slides(read, parts(slidePattern)) };
  return { kind: "xlsx", sheets: sheets(read, parts(sheetPattern)) };
}

function OfficeParagraph({ paragraph }: { paragraph: Paragraph }): React.JSX.Element {
  const Tag = paragraph.heading ? "h2" : "p";
  return (
    <Tag style={paragraph.style}>
      {paragraph.runs.map((run) => (
        <span key={run.index} style={run.style}>
          {run.text}
        </span>
      ))}
    </Tag>
  );
}

function WordView({ blocks }: { blocks: WordBlock[] }): React.JSX.Element {
  return (
    <div className="office-section">
      {!blocks.length ? <p>No readable document content.</p> : null}
      {blocks.map((block) =>
        "paragraph" in block ? (
          <OfficeParagraph key={block.index} paragraph={block.paragraph} />
        ) : (
          <table key={block.index}>
            <tbody>
              {block.rows.map((row, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: document cells are positional and immutable.
                <tr key={index}>
                  {row.map((cell, column) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: document cells are positional and immutable.
                    <td key={column}>
                      {cell.map((paragraph, line) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: document paragraphs are positional and immutable.
                        <OfficeParagraph key={line} paragraph={paragraph} />
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ),
      )}
    </div>
  );
}

function PresentationView({ pages }: { pages: Slide[] }): React.JSX.Element {
  const [index, setIndex] = useState(0);
  const page = pages[index];
  if (!page) return <div className="content-state">This presentation has no readable slides.</div>;
  return (
    <section className="office-section">
      <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
        Previous slide
      </button>{" "}
      <button
        type="button"
        disabled={index + 1 >= pages.length}
        onClick={() => setIndex(index + 1)}
      >
        Next slide
      </button>{" "}
      <span role="status">
        Slide {index + 1} of {pages.length}
      </span>
      <div
        style={{
          position: "relative",
          aspectRatio: page.ratio,
          background: page.background,
          color: "#151515",
          containerType: "size",
          overflow: "hidden",
          width: "100%",
          marginTop: 8,
        }}
      >
        {page.shapes.map((shape) => (
          <div key={shape.index} style={shape.style}>
            {shape.paragraphs.map((paragraph, line) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: slide paragraphs are positional and immutable.
              <OfficeParagraph key={line} paragraph={paragraph} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function OfficeView({ blob, path }: { blob: Blob; path: string }): React.JSX.Element {
  const [document, setDocument] = useState<OfficeDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void blob
      .arrayBuffer()
      .then((buffer) => openOffice(new Uint8Array(buffer), extensionOf(path)))
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
        Read-only preview. Download the original for embedded media, charts, and full formatting.
      </p>
      {document.kind === "docx" ? <WordView blocks={document.blocks} /> : null}
      {document.kind === "pptx" ? <PresentationView pages={document.pages} /> : null}
      {document.kind === "xlsx" ? <SpreadsheetView sheets={document.sheets} /> : null}
    </article>
  );
}
