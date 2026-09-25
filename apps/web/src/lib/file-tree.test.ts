import type { ManifestFile } from "@share/protocol";
import { describe, expect, it } from "vitest";
import { buildFileTree, directoryPaths } from "./file-tree";

function file(path: string, id: string): ManifestFile {
  return {
    id,
    path,
    mime: "text/plain",
    size: 1,
    chunkSize: 4_194_304,
    chunks: 1,
    noncePrefix: "AAAAAAAAAAA",
  };
}

describe("buildFileTree", () => {
  it("builds and sorts nested folders while preserving each manifest file", () => {
    const tree = buildFileTree([
      file("src/components/Button.tsx", "file_button_0001"),
      file("README.md", "file_readme_0001"),
      file("src/index.ts", "file_index_000001"),
      file("docs/api/reference.md", "file_reference_01"),
    ]);

    expect(directoryPaths(tree)).toEqual(["docs", "docs/api", "src", "src/components"]);
    expect(tree).toMatchObject([
      {
        kind: "directory",
        name: "docs",
        children: [
          {
            kind: "directory",
            name: "api",
            children: [{ kind: "file", name: "reference.md" }],
          },
        ],
      },
      {
        kind: "directory",
        name: "src",
        children: [
          {
            kind: "directory",
            name: "components",
            children: [{ kind: "file", name: "Button.tsx" }],
          },
          { kind: "file", name: "index.ts" },
        ],
      },
      { kind: "file", name: "README.md" },
    ]);
  });
});
