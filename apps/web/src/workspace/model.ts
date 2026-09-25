import type {
  Workspace,
  WorkspaceEntry,
  WorkspaceFile,
  WorkspaceFolder,
  WorkspaceImportFile,
} from "./types";

export interface WorkspaceTreeNode {
  entry: WorkspaceEntry;
  children: WorkspaceTreeNode[];
}

export function createWorkspace(name = "Untitled", now = Date.now()): Workspace {
  return {
    id: crypto.randomUUID(),
    name: normalizeWorkspaceName(name),
    createdAt: now,
    updatedAt: now,
    entries: [],
  };
}

export function duplicateWorkspace(workspace: Workspace, now = Date.now()): Workspace {
  const ids = new Map(workspace.entries.map((entry) => [entry.id, crypto.randomUUID()]));
  return {
    id: crypto.randomUUID(),
    name: `${workspace.name} copy`,
    createdAt: now,
    updatedAt: now,
    entries: workspace.entries.map((entry) => ({
      ...entry,
      id: ids.get(entry.id) ?? crypto.randomUUID(),
      parentId: entry.parentId ? (ids.get(entry.parentId) ?? null) : null,
      createdAt: now,
      updatedAt: now,
    })),
  };
}

export function renameWorkspace(workspace: Workspace, name: string): Workspace {
  return touch({ ...workspace, name: normalizeWorkspaceName(name) });
}

export function addFile(
  workspace: Workspace,
  parentId: string | null,
  name: string,
  blob = new Blob([""], { type: mimeForName(name, "text/plain") }),
): { workspace: Workspace; entry: WorkspaceFile } {
  requireFolder(workspace, parentId);
  const normalizedName = normalizeEntryName(name);
  requireUniqueName(workspace.entries, parentId, normalizedName);
  const now = Date.now();
  const entry: WorkspaceFile = {
    id: crypto.randomUUID(),
    type: "file",
    name: normalizedName,
    parentId,
    mimeType: blob.type || mimeForName(normalizedName, "text/plain"),
    blob,
    createdAt: now,
    updatedAt: now,
  };
  return { workspace: touch({ ...workspace, entries: [...workspace.entries, entry] }, now), entry };
}

export function addFolder(
  workspace: Workspace,
  parentId: string | null,
  name: string,
): { workspace: Workspace; entry: WorkspaceFolder } {
  requireFolder(workspace, parentId);
  const normalizedName = normalizeEntryName(name);
  requireUniqueName(workspace.entries, parentId, normalizedName);
  const now = Date.now();
  const entry: WorkspaceFolder = {
    id: crypto.randomUUID(),
    type: "folder",
    name: normalizedName,
    parentId,
    createdAt: now,
    updatedAt: now,
  };
  return { workspace: touch({ ...workspace, entries: [...workspace.entries, entry] }, now), entry };
}

export function importFiles(
  workspace: Workspace,
  files: WorkspaceImportFile[],
  parentId: string | null = null,
  stripCommonRoot = false,
): Workspace {
  requireFolder(workspace, parentId);
  const paths = files.map(({ path, file }) => ({
    file,
    segments: safeSegments(path || file.name),
  }));
  const commonRoot = stripCommonRoot ? sharedRoot(paths.map(({ segments }) => segments)) : null;
  const entries = [...workspace.entries];
  const importedFolders = new Map<string, string>();
  const now = Date.now();

  for (const item of paths) {
    const segments = commonRoot ? item.segments.slice(1) : item.segments;
    if (segments.length === 0) continue;
    let currentParent = parentId;

    for (const folderName of segments.slice(0, -1)) {
      const importKey = `${currentParent ?? "root"}\0${folderName}`;
      const importedId = importedFolders.get(importKey);
      if (importedId) {
        currentParent = importedId;
        continue;
      }
      const existing = entries.find(
        (entry) =>
          entry.type === "folder" &&
          entry.parentId === currentParent &&
          namesEqual(entry.name, folderName),
      );
      if (existing?.type === "folder") {
        currentParent = existing.id;
        importedFolders.set(importKey, existing.id);
        continue;
      }
      const folder: WorkspaceFolder = {
        id: crypto.randomUUID(),
        type: "folder",
        name: uniqueName(entries, currentParent, folderName),
        parentId: currentParent,
        createdAt: now,
        updatedAt: now,
      };
      entries.push(folder);
      currentParent = folder.id;
      importedFolders.set(importKey, folder.id);
    }

    const requestedName = segments.at(-1) ?? item.file.name;
    const file: WorkspaceFile = {
      id: crypto.randomUUID(),
      type: "file",
      name: uniqueName(entries, currentParent, requestedName),
      parentId: currentParent,
      mimeType: item.file.type || mimeForName(requestedName),
      blob: item.file,
      createdAt: now,
      updatedAt: now,
    };
    entries.push(file);
  }

  return touch({ ...workspace, entries }, now);
}

export function updateFileContent(workspace: Workspace, id: string, content: string): Workspace {
  const current = workspace.entries.find((entry) => entry.id === id);
  if (current?.type !== "file") throw new Error("File not found");
  const now = Date.now();
  return touch(
    {
      ...workspace,
      entries: workspace.entries.map((entry) =>
        entry.id === id
          ? {
              ...current,
              blob: new Blob([content], { type: current.mimeType || mimeForName(current.name) }),
              updatedAt: now,
            }
          : entry,
      ),
    },
    now,
  );
}

export function renameEntry(workspace: Workspace, id: string, name: string): Workspace {
  const current = requireEntry(workspace, id);
  const normalizedName = normalizeEntryName(name);
  requireUniqueName(workspace.entries, current.parentId, normalizedName, id);
  const now = Date.now();
  return touch(
    {
      ...workspace,
      entries: workspace.entries.map((entry) =>
        entry.id === id
          ? entry.type === "file"
            ? {
                ...entry,
                name: normalizedName,
                mimeType: mimeForName(normalizedName, entry.mimeType),
                updatedAt: now,
              }
            : { ...entry, name: normalizedName, updatedAt: now }
          : entry,
      ),
    },
    now,
  );
}

export function moveEntry(workspace: Workspace, id: string, parentId: string | null): Workspace {
  const current = requireEntry(workspace, id);
  requireFolder(workspace, parentId);
  if (id === parentId || descendantsOf(workspace, id).has(parentId ?? "")) {
    throw new Error("A folder cannot be moved inside itself");
  }
  requireUniqueName(workspace.entries, parentId, current.name, id);
  const now = Date.now();
  return touch(
    {
      ...workspace,
      entries: workspace.entries.map((entry) =>
        entry.id === id ? { ...entry, parentId, updatedAt: now } : entry,
      ),
    },
    now,
  );
}

export function deleteEntry(workspace: Workspace, id: string): Workspace {
  requireEntry(workspace, id);
  const removed = descendantsOf(workspace, id);
  removed.add(id);
  return touch({
    ...workspace,
    entries: workspace.entries.filter((entry) => !removed.has(entry.id)),
  });
}

export function buildWorkspaceTree(workspace: Workspace): WorkspaceTreeNode[] {
  const byParent = new Map<string | null, WorkspaceEntry[]>();
  for (const entry of workspace.entries) {
    const siblings = byParent.get(entry.parentId) ?? [];
    siblings.push(entry);
    byParent.set(entry.parentId, siblings);
  }
  const build = (parentId: string | null): WorkspaceTreeNode[] =>
    (byParent.get(parentId) ?? []).sort(compareEntries).map((entry) => ({
      entry,
      children: entry.type === "folder" ? build(entry.id) : [],
    }));
  return build(null);
}

export function pathForEntry(workspace: Workspace, entryId: string): string {
  const byId = new Map(workspace.entries.map((entry) => [entry.id, entry]));
  const segments: string[] = [];
  let current = byId.get(entryId);
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current.id)) throw new Error("Workspace contains a folder cycle");
    visited.add(current.id);
    segments.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return segments.join("/");
}

export function workspaceFiles(
  workspace: Workspace,
): Array<{ entry: WorkspaceFile; path: string }> {
  return workspace.entries
    .filter((entry): entry is WorkspaceFile => entry.type === "file")
    .map((entry) => ({ entry, path: pathForEntry(workspace, entry.id) }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function folderOptions(
  workspace: Workspace,
  movingEntryId?: string,
): Array<{ id: string | null; label: string }> {
  const excluded = movingEntryId ? descendantsOf(workspace, movingEntryId) : new Set<string>();
  if (movingEntryId) excluded.add(movingEntryId);
  return [
    { id: null, label: "Workspace root" },
    ...workspace.entries
      .filter(
        (entry): entry is WorkspaceFolder => entry.type === "folder" && !excluded.has(entry.id),
      )
      .map((entry) => ({ id: entry.id, label: pathForEntry(workspace, entry.id) }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  ];
}

export function mimeForName(name: string, fallback = "application/octet-stream"): string {
  const extension = name.split(".").at(-1)?.toLowerCase();
  const types: Record<string, string> = {
    css: "text/css",
    csv: "text/csv",
    gif: "image/gif",
    html: "text/html",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    js: "text/javascript",
    json: "application/json",
    jsx: "text/jsx",
    md: "text/markdown",
    mdx: "text/markdown",
    py: "text/x-python",
    pdf: "application/pdf",
    png: "image/png",
    rs: "text/x-rust",
    sh: "text/x-shellscript",
    sql: "text/x-sql",
    svg: "image/svg+xml",
    ts: "text/typescript",
    tsx: "text/tsx",
    txt: "text/plain",
    webp: "image/webp",
    xml: "application/xml",
    yaml: "application/yaml",
    yml: "application/yaml",
  };
  return extension ? (types[extension] ?? fallback) : fallback;
}

function normalizeWorkspaceName(name: string): string {
  return name.trim() || "Untitled";
}

function normalizeEntryName(name: string): string {
  const normalized = name.trim();
  if (!normalized || normalized === "." || normalized === ".." || /[/\\]/u.test(normalized)) {
    throw new Error("Names cannot be empty or contain slashes");
  }
  return normalized;
}

function safeSegments(path: string): string[] {
  const segments = path.replaceAll("\\", "/").split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Unsafe file path: ${path}`);
  }
  return segments.map(normalizeEntryName);
}

function sharedRoot(paths: string[][]): string | null {
  const root = paths[0]?.[0];
  return root && paths.every((segments) => segments.length > 1 && segments[0] === root)
    ? root
    : null;
}

function requireEntry(workspace: Workspace, id: string): WorkspaceEntry {
  const entry = workspace.entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error("Workspace entry not found");
  return entry;
}

function requireFolder(workspace: Workspace, id: string | null): void {
  if (id === null) return;
  const entry = requireEntry(workspace, id);
  if (entry.type !== "folder") throw new Error("The destination must be a folder");
}

function requireUniqueName(
  entries: WorkspaceEntry[],
  parentId: string | null,
  name: string,
  ignoredId?: string,
): void {
  if (
    entries.some(
      (entry) =>
        entry.id !== ignoredId && entry.parentId === parentId && namesEqual(entry.name, name),
    )
  ) {
    throw new Error(`An item named “${name}” already exists here`);
  }
}

function uniqueName(entries: WorkspaceEntry[], parentId: string | null, requested: string): string {
  const normalized = normalizeEntryName(requested);
  if (!entries.some((entry) => entry.parentId === parentId && namesEqual(entry.name, normalized))) {
    return normalized;
  }
  const dot = normalized.lastIndexOf(".");
  const hasExtension = dot > 0;
  const stem = hasExtension ? normalized.slice(0, dot) : normalized;
  const extension = hasExtension ? normalized.slice(dot) : "";
  let index = 2;
  while (
    entries.some(
      (entry) =>
        entry.parentId === parentId && namesEqual(entry.name, `${stem} (${index})${extension}`),
    )
  ) {
    index += 1;
  }
  return `${stem} (${index})${extension}`;
}

function namesEqual(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}

function descendantsOf(workspace: Workspace, id: string): Set<string> {
  const result = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of workspace.entries) {
      if (entry.parentId === id || (entry.parentId !== null && result.has(entry.parentId))) {
        if (!result.has(entry.id)) {
          result.add(entry.id);
          changed = true;
        }
      }
    }
  }
  return result;
}

function compareEntries(left: WorkspaceEntry, right: WorkspaceEntry): number {
  if (left.type !== right.type) return left.type === "folder" ? -1 : 1;
  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
}

function touch(workspace: Workspace, now = Date.now()): Workspace {
  return { ...workspace, updatedAt: now };
}
