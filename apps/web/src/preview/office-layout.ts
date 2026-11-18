import type { CSSProperties } from "react";
import type { Sheet } from "./SpreadsheetView";

const word = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const drawing = "http://schemas.openxmlformats.org/drawingml/2006/main";
const ppt = "http://schemas.openxmlformats.org/presentationml/2006/main";
const xlsx = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

type Run = { index: number; text: string; style: CSSProperties };
export type Paragraph = { runs: Run[]; style: CSSProperties; heading: boolean };
export type WordBlock =
  | { index: number; paragraph: Paragraph }
  | { index: number; rows: Paragraph[][][] };
export type Slide = {
  id: string;
  ratio: number;
  background: string;
  shapes: { index: number; style: CSSProperties; paragraphs: Paragraph[] }[];
};
type ReadXml = (name: string) => Document | null;

function child(parent: Element | undefined, tag: string, ns: string): Element | undefined {
  return [...(parent?.children ?? [])].find(
    (node) => node.localName === tag && node.namespaceURI === ns,
  );
}
function attr(node: Element | undefined, name: string, ns?: string): string | undefined {
  return (ns ? node?.getAttributeNS(ns, name) : node?.getAttribute(name)) ?? undefined;
}
function number(raw: string | undefined, fallback: number, low: number, high: number): number {
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback;
}
function color(raw?: string): string | undefined {
  return raw && /^[0-9a-f]{6}$/iu.test(raw) ? `#${raw}` : undefined;
}

function wordParagraph(node: Element): Paragraph {
  const props = child(node, "pPr", word);
  const style = attr(child(props, "pStyle", word), "val", word);
  const alignment = attr(child(props, "jc", word), "val", word);
  const runs = [...node.getElementsByTagNameNS(word, "r")].slice(0, 512).map((run, index) => {
    const properties = child(run, "rPr", word);
    const option = (name: string) => {
      const item = child(properties, name, word);
      return item && !["0", "false", "off", "none"].includes(attr(item, "val", word) ?? "");
    };
    const size = attr(child(properties, "sz", word), "val", word);
    const text = [...run.children]
      .map((part) => {
        if (part.namespaceURI !== word) return "";
        if (part.localName === "t") return part.textContent ?? "";
        if (part.localName === "br") return "\n";
        return part.localName === "tab" ? "\t" : "";
      })
      .join("");
    return {
      index,
      text,
      style: {
        fontWeight: option("b") ? 700 : undefined,
        fontStyle: option("i") ? "italic" : undefined,
        textDecoration: option("u") ? "underline" : undefined,
        color: color(attr(child(properties, "color", word), "val", word)),
        fontSize: size ? `${number(size, 24, 8, 192) / 2}pt` : undefined,
      },
    };
  });
  return {
    heading: /^(heading|title)/iu.test(style ?? ""),
    style: {
      textAlign:
        alignment === "both"
          ? "justify"
          : alignment === "center" || alignment === "right"
            ? alignment
            : "left",
      whiteSpace: "pre-wrap",
    },
    runs,
  };
}
export function wordBlocks(read: ReadXml): WordBlock[] {
  const body = read("word/document.xml")?.getElementsByTagNameNS(word, "body")[0];
  const result: WordBlock[] = [];
  for (const node of [...(body?.children ?? [])].slice(0, 500)) {
    const index = result.length;
    if (node.localName === "p") result.push({ index, paragraph: wordParagraph(node) });
    if (node.localName !== "tbl") continue;
    const rows = [...node.children].filter((row) => row.localName === "tr").slice(0, 60);
    result.push({
      index,
      rows: rows.map((row) =>
        [...row.children]
          .filter((cell) => cell.localName === "tc")
          .slice(0, 40)
          .map((cell) =>
            [...cell.children]
              .filter((p) => p.localName === "p")
              .slice(0, 20)
              .map(wordParagraph),
          ),
      ),
    });
  }
  return result;
}

function slideParagraph(node: Element, height: number): Paragraph {
  const alignment = attr(child(node, "pPr", drawing), "algn");
  const runs: Run[] = [];
  for (const element of [...node.children].slice(0, 128)) {
    const index = runs.length;
    if (element.localName === "br") {
      runs.push({ index, text: "\n", style: {} });
      continue;
    }
    const text = child(element, "t", drawing)?.textContent;
    if (!text) continue;
    const props = child(element, "rPr", drawing);
    const size = number(attr(props, "sz"), 1800, 400, 10000);
    runs.push({
      index,
      text,
      style: {
        fontSize: `${((size * 127) / height) * 100}cqh`,
        fontWeight: attr(props, "b") === "1" ? 700 : undefined,
        fontStyle: attr(props, "i") === "1" ? "italic" : undefined,
        color: color(attr(child(child(props, "solidFill", drawing), "srgbClr", drawing), "val")),
      },
    });
  }
  return {
    runs,
    heading: false,
    style: {
      whiteSpace: "pre-wrap",
      textAlign: alignment === "ctr" ? "center" : alignment === "r" ? "right" : "left",
    },
  };
}
export function slides(read: ReadXml, parts: string[]): Slide[] {
  const size = read("ppt/presentation.xml")?.getElementsByTagNameNS(ppt, "sldSz")[0];
  const width = number(attr(size, "cx"), 12_192_000, 1, 30_000_000);
  const height = number(attr(size, "cy"), 6_858_000, 1, 30_000_000);
  const result: Slide[] = [];
  for (const id of parts.slice(0, 80)) {
    const doc = read(id);
    if (!doc) continue;
    const background =
      color(
        attr(
          doc.getElementsByTagNameNS(ppt, "bg")[0]?.getElementsByTagNameNS(drawing, "srgbClr")[0],
          "val",
        ),
      ) ?? "#fff";
    const shapes: Slide["shapes"] = [];
    for (const shape of [...doc.getElementsByTagNameNS(ppt, "sp")].slice(0, 100)) {
      const props = child(shape, "spPr", ppt);
      const transform = child(props, "xfrm", drawing);
      const offset = child(transform, "off", drawing);
      const extent = child(transform, "ext", drawing);
      const text = child(shape, "txBody", ppt);
      const fill = color(
        attr(child(child(props, "solidFill", drawing), "srgbClr", drawing), "val"),
      );
      const paragraphs = [...(text?.children ?? [])]
        .filter((p) => p.localName === "p")
        .slice(0, 60);
      if (!fill && !paragraphs.length) continue;
      const pct = (node: Element | undefined, field: string, limit: number, fallback: number) =>
        `${(100 * number(attr(node, field), fallback, -limit, limit * 2)) / limit}%`;
      shapes.push({
        index: shapes.length,
        style: transform
          ? {
              position: "absolute",
              left: pct(offset, "x", width, 0),
              top: pct(offset, "y", height, 0),
              width: pct(extent, "cx", width, width),
              height: pct(extent, "cy", height, height),
              background: fill,
              overflow: "hidden",
            }
          : { position: "relative", margin: "2% 4%", background: fill },
        paragraphs: paragraphs.map((item) => slideParagraph(item, height)),
      });
    }
    result.push({ id, ratio: width / height, background, shapes });
  }
  return result;
}

export function sheets(read: ReadXml, parts: string[]): Sheet[] {
  const names = new Map<string, string>();
  const workbook = read("xl/workbook.xml");
  const relations = read("xl/_rels/workbook.xml.rels");
  const targets = new Map(
    [...(relations?.documentElement.children ?? [])].map((node) => [
      node.getAttribute("Id"),
      node.getAttribute("Target")?.replace(/^\/?(?:xl\/)?/u, "xl/"),
    ]),
  );
  for (const sheet of workbook?.getElementsByTagNameNS(xlsx, "sheet") ?? []) {
    const target = targets.get(attr(sheet, "id", rel) ?? "");
    if (target) names.set(target, attr(sheet, "name") ?? target);
  }
  const index = read("xl/sharedStrings.xml");
  const strings = [...(index?.getElementsByTagNameNS(xlsx, "si") ?? [])].map((node) =>
    [...node.getElementsByTagNameNS(xlsx, "t")].map((part) => part.textContent ?? "").join(""),
  );
  const result: Sheet[] = [];
  let remaining = 100_000;
  for (const id of [...new Set([...names.keys(), ...parts])].slice(0, 100)) {
    if (!parts.includes(id)) continue;
    const document = read(id);
    if (!document) continue;
    const rows: Sheet["rows"] = [];
    for (const row of document.getElementsByTagNameNS(xlsx, "row")) {
      if (rows.length >= 5_000 || remaining <= 0) break;
      const cells: string[] = [];
      for (const cell of row.getElementsByTagNameNS(xlsx, "c")) {
        if (remaining-- <= 0) break;
        const value = child(cell, "v", xlsx)?.textContent ?? "";
        const type = attr(cell, "t");
        const ref = /^[A-Z]{1,4}(?=\d)/u.exec(attr(cell, "r") ?? "")?.[0];
        const column = ref
          ? [...ref].reduce((i, ch) => i * 26 + ch.charCodeAt(0) - 64, 0) - 1
          : cells.length;
        if (column >= 200) continue;
        const inline = [...cell.getElementsByTagNameNS(xlsx, "t")]
          .map((item) => item.textContent ?? "")
          .join("");
        cells[column] = (
          type === "s" && value
            ? (strings[Number(value)] ?? "")
            : type === "b"
              ? value === "1"
                ? "TRUE"
                : "FALSE"
              : inline || value
        ).slice(0, 4000);
      }
      rows.push({ index: Number(attr(row, "r")) || rows.length + 1, cells });
    }
    result.push({ id, name: names.get(id) ?? `Sheet ${result.length + 1}`, rows });
  }
  return result;
}
