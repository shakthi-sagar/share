import { describe, expect, it } from "vitest";
import {
  addFile,
  addFolder,
  createWorkspace,
  deleteEntry,
  duplicateWorkspace,
  folderOptions,
  importFiles,
  moveEntry,
  pathForEntry,
  renameEntry,
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

  it("offers only valid move destinations, which is what makes a drop target legal", () => {
    const docs = addFolder(createWorkspace("project", 1), null, "docs");
    const api = addFolder(docs.workspace, docs.entry.id, "api");
    const readme = addFile(api.workspace, null, "readme.md");

    expect(folderOptions(readme.workspace, readme.entry.id).map((option) => option.id)).toEqual([
      null,
      docs.entry.id,
      api.entry.id,
    ]);

    // A folder cannot be dropped into itself or into one of its own descendants.
    expect(folderOptions(api.workspace, docs.entry.id).map((option) => option.id)).toEqual([null]);
    expect(() => moveEntry(api.workspace, docs.entry.id, api.entry.id)).toThrow(
      "A folder cannot be moved inside itself",
    );
    expect(() => moveEntry(api.workspace, docs.entry.id, docs.entry.id)).toThrow(
      "A folder cannot be moved inside itself",
    );
  });

  it("refuses a move that would collide with an existing name in the destination", () => {
    const docs = addFolder(createWorkspace("project", 1), null, "docs");
    const nested = addFile(docs.workspace, docs.entry.id, "notes.md");
    const root = addFile(nested.workspace, null, "notes.md");

    expect(() => moveEntry(root.workspace, root.entry.id, docs.entry.id)).toThrow(
      "An item named “notes.md” already exists here",
    );
  });

  it("refuses typed names that could display as a different name", () => {
    const { workspace, entry } = addFile(createWorkspace("w", 1), null, "notes.md");
    expect(() => renameEntry(workspace, entry.id, "invoice\u202Efdp.exe")).toThrow(
      /text-direction/u,
    );
    expect(() => addFolder(workspace, null, "tab\there")).toThrow(/control/u);
  });

  it("strips invisible formatting from imported paths and workspace names", () => {
    const workspace = importFiles(createWorkspace("spoof\u202Ename", 1), [
      { path: "dir\u2066/invoice\u202Efdp.exe", file: file("x", "x", "text/plain") },
    ]);
    expect(workspace.name).toBe("spoofname");
    expect(workspaceFiles(workspace).map(({ path }) => path)).toEqual(["dir/invoicefdp.exe"]);
  });
});

function file(content: string, name: string, type: string): File {
  return new File([content], name, { type });
}
