import { describe, expect, it } from "vitest";
import { displayPath, isPublishablePath, isSafeRelativePath, shareManifestSchema } from "../src";

describe("relative paths", () => {
  it("accepts nested relative paths", () => {
    expect(isSafeRelativePath("docs/guide.md")).toBe(true);
    expect(isPublishablePath("docs/guide.md")).toBe(true);
    expect(isPublishablePath("résumé/日本語.txt")).toBe(true);
  });

  it("rejects traversal, absolute, and empty segments", () => {
    for (const path of ["", "/etc/passwd", "../x", "a/../b", "a//b", "a/./b", "a\\b", "a\0b"]) {
      expect(isSafeRelativePath(path)).toBe(false);
      expect(isPublishablePath(path)).toBe(false);
    }
    expect(isSafeRelativePath("a".repeat(1025))).toBe(false);
  });

  it("refuses to publish paths with invisible formatting characters", () => {
    for (const path of ["invoice‮fdp.exe", "a⁦b", "tab\there", "bell\u0007", "c1\u0085"]) {
      expect(isSafeRelativePath(path)).toBe(true);
      expect(isPublishablePath(path)).toBe(false);
    }
  });

  it("stays consistent across repeated calls", () => {
    expect(isPublishablePath("x‮y")).toBe(false);
    expect(isPublishablePath("x‮y")).toBe(false);
    expect(isPublishablePath("plain")).toBe(true);
  });

  it("makes invisible characters visible for display", () => {
    expect(displayPath("invoice‮fdp.exe")).toBe("invoice\\u{202E}fdp.exe");
    expect(displayPath("a\tb")).toBe("a\\u{0009}b");
    expect(displayPath("docs/guide.md")).toBe("docs/guide.md");
  });

  it("keeps parsing manifests from before the publish rule", () => {
    const manifest = {
      version: 1,
      name: "Old share",
      files: [
        {
          id: "FileObject_123456",
          path: "invoice‮fdp.exe",
          mime: "application/octet-stream",
          size: 1,
          chunkSize: 1,
          chunks: 1,
          noncePrefix: "AAAAAAAAAAA",
        },
      ],
    };
    expect(shareManifestSchema.safeParse(manifest).success).toBe(true);
  });
});
