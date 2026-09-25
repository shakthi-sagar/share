import { describe, expect, it } from "vitest";
import {
  addFile,
  addFolder,
  createWorkspace,
  deleteEntry,
  duplicateWorkspace,
  importFiles,
  moveEntry,
  pathForEntry,
  updateFileContent,
  workspaceFiles,
} from "./model";

describe("workspace model", () => {
  it("imports nested folders and strips the selected folder root", () => {
    const workspace = importFiles(
      createWorkspace("project", 1),
      [
        { path: "project/README.md", file: file("readme", "README.md", "text/markdown") },
        {
          path: "project/docs/notes.md",
          file: file("notes", "notes.md", "text/markdown"),
        },
        { path: "project/assets/logo.png", file: file("png", "logo.png", "image/png") },
      ],
      null,
      true,
    );

    expect(workspaceFiles(workspace).map(({ path }) => path)).toEqual([
      "assets/logo.png",
      "docs/notes.md",
      "README.md",
    ]);
    expect(workspace.entries.filter((entry) => entry.type === "folder")).toHaveLength(2);
  });

  it("creates, edits, moves, and recursively deletes entries", async () => {
    let workspace = createWorkspace("Untitled", 1);
    const docs = addFolder(workspace, null, "docs");
    workspace = docs.workspace;
    const readme = addFile(workspace, null, "README.md");
    workspace = updateFileContent(readme.workspace, readme.entry.id, "# Hello");
    workspace = moveEntry(workspace, readme.entry.id, docs.entry.id);

    expect(pathForEntry(workspace, readme.entry.id)).toBe("docs/README.md");
    const stored = workspace.entries.find((entry) => entry.id === readme.entry.id);
    expect(stored?.type).toBe("file");
    if (stored?.type === "file") expect(await stored.blob.text()).toBe("# Hello");

    workspace = deleteEntry(workspace, docs.entry.id);
    expect(workspace.entries).toHaveLength(0);
  });

  it("duplicates a workspace without reusing workspace or entry IDs", () => {
    const original = addFile(createWorkspace("Notes", 1), null, "notes.txt").workspace;
    const copy = duplicateWorkspace(original, 2);

    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe("Notes copy");
    expect(copy.entries[0]?.id).not.toBe(original.entries[0]?.id);
    expect(workspaceFiles(copy).map(({ path }) => path)).toEqual(["notes.txt"]);
  });
});

function file(content: string, name: string, type: string): File {
  return new File([content], name, { type });
}
