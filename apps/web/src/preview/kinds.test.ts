import { describe, expect, it } from "vitest";
import { languageFor, looksLikeText, previewKind, safeMediaType } from "./kinds";

describe("preview kinds", () => {
  it("classifies by extension first and MIME type second", () => {
    const cases: [string, string, string][] = [
      ["docs/readme.md", "", "markdown"],
      ["data.csv", "text/plain", "csv"],
      ["data.tsv", "", "csv"],
      ["notebook.ipynb", "", "json"],
      ["logo.svg", "application/octet-stream", "svg"],
      ["page.html", "", "html"],
      ["paper.pdf", "", "pdf"],
      ["photo.JPG", "", "image"],
      ["clip.mp4", "", "video"],
      ["song.mp3", "", "audio"],
      ["font.woff2", "", "font"],
      ["src/main.rs", "", "code"],
      ["Dockerfile", "", "code"],
      [".gitignore", "", "code"],
      ["LICENSE", "", "text"],
      ["server.log", "", "text"],
      ["mystery", "text/x-custom", "text"],
      ["photo.heic", "image/heic", "binary"],
      ["archive.zip", "application/zip", "binary"],
      ["unknown", "", "binary"],
    ];
    for (const [path, mime, kind] of cases) {
      expect([path, previewKind(path, mime)]).toEqual([path, kind]);
    }
  });

  it("maps code files to highlight languages", () => {
    expect(languageFor("a/b.tsx")).toBe("typescript");
    expect(languageFor("Makefile")).toBe("makefile");
    expect(languageFor("notes.txt")).toBeUndefined();
  });

  it("recognizes text in unknown files", () => {
    const encoder = new TextEncoder();
    expect(looksLikeText(encoder.encode("plain words\nand lines ✓"))).toBe(true);
    expect(looksLikeText(Uint8Array.of(0x50, 0x4b, 0x03, 0x04, 0x00, 0x00))).toBe(false);
    expect(looksLikeText(Uint8Array.of(0xff, 0xfe, 0xfd, 0x41))).toBe(false);
    expect(looksLikeText(Uint8Array.from({ length: 200 }, (_, i) => (i % 4 === 0 ? 1 : 65)))).toBe(
      false,
    );
  });

  it("never lets the sender's MIME type choose how a blob is interpreted", () => {
    expect(safeMediaType("image", "x.png", "text/html")).toBe("image/png");
    expect(safeMediaType("image", "x.jpg", "")).toBe("image/jpeg");
    expect(safeMediaType("svg", "x.svg", "text/html")).toBe("image/svg+xml");
    expect(safeMediaType("pdf", "x.pdf", "text/html")).toBe("application/pdf");
    expect(safeMediaType("video", "x.mov", "")).toBe("video/quicktime");
    expect(safeMediaType("binary", "x.html", "text/html")).toBe("application/octet-stream");
  });
});
