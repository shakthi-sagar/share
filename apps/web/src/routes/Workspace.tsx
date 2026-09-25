import {
  ChevronDown,
  ChevronRight,
  Download,
  File,
  FileCode2,
  FileImage,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  FolderUp,
  Home,
  Menu,
  Pencil,
  Share2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActionDialog } from "../components/ActionDialog";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { SharePublisher } from "../components/SharePublisher";
import { filePreviewKind } from "../lib/file-kind";
import { formatBytes } from "../lib/format";
import {
  addFile,
  addFolder,
  buildWorkspaceTree,
  deleteEntry,
  folderOptions,
  importFiles,
  moveEntry,
  pathForEntry,
  renameEntry,
  renameWorkspace,
  updateFileContent,
  type WorkspaceTreeNode,
  workspaceFiles,
} from "../workspace/model";
import { workspaceStore } from "../workspace/store";
import type { Workspace, WorkspaceEntry, WorkspaceImportFile } from "../workspace/types";

type SaveState = "saved" | "saving" | "error";
type WorkspaceDialog =
  | { kind: "new-file" | "new-folder" }
  | { kind: "rename" | "delete"; entry: WorkspaceEntry }
  | null;

export function WorkspaceEditor({ id }: { id: string }): React.JSX.Element {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialog, setDialog] = useState<WorkspaceDialog>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const saveVersion = useRef(0);

  useEffect(() => {
    let active = true;
    void workspaceStore
      .get(id)
      .then((stored) => {
        if (!active) return;
        setWorkspace(stored);
        if (stored) {
          setSelectedId(workspaceFiles(stored)[0]?.entry.id ?? null);
          setExpanded(
            new Set(
              stored.entries.filter((entry) => entry.type === "folder").map((entry) => entry.id),
            ),
          );
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setMessage(caught instanceof Error ? caught.message : "Unable to open workspace");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  function apply(next: Workspace): void {
    const version = saveVersion.current + 1;
    saveVersion.current = version;
    setWorkspace(next);
    setSaveState("saving");
    setMessage(null);
    void workspaceStore
      .update(next)
      .then(() => {
        if (saveVersion.current === version) setSaveState("saved");
      })
      .catch((caught: unknown) => {
        setSaveState("error");
        setMessage(caught instanceof Error ? caught.message : "Unable to save local changes");
      });
  }

  if (loading) {
    return <div className="workspace-loading">Opening local workspace…</div>;
  }
  if (!workspace) {
    return (
      <main className="workspace-missing">
        <Folder size={28} />
        <h1>Workspace not found</h1>
        <p>This workspace is not stored in this browser.</p>
        <a className="button button-primary" href="/">
          Return home
        </a>
      </main>
    );
  }

  const selected = workspace.entries.find((entry) => entry.id === selectedId) ?? null;
  const parentId = selected?.type === "folder" ? selected.id : (selected?.parentId ?? null);
  const files = workspaceFiles(workspace);

  function createFile(name: string): void {
    if (!workspace) return;
    try {
      const result = addFile(workspace, parentId, name);
      setExpanded((current) => new Set(current).add(parentId ?? ""));
      apply(result.workspace);
      setSelectedId(result.entry.id);
      setDialog(null);
    } catch (caught) {
      throw caught instanceof Error ? caught : new Error("Unable to create file");
    }
  }

  function createFolder(name: string): void {
    if (!workspace) return;
    try {
      const result = addFolder(workspace, parentId, name);
      setExpanded((current) => new Set(current).add(result.entry.id).add(parentId ?? ""));
      apply(result.workspace);
      setSelectedId(result.entry.id);
      setDialog(null);
    } catch (caught) {
      throw caught instanceof Error ? caught : new Error("Unable to create folder");
    }
  }

  function addImportedFiles(list: FileList, folder: boolean): void {
    if (!workspace) return;
    const incoming: WorkspaceImportFile[] = [...list].map((file) => ({
      file,
      path: file.webkitRelativePath || file.name,
    }));
    if (incoming.length === 0) return;
    try {
      const next = importFiles(workspace, incoming, parentId, false);
      apply(next);
      if (parentId) setExpanded((current) => new Set(current).add(parentId));
      if (folder) {
        const importedRoot = incoming[0]?.path.split("/")[0];
        const root = next.entries.find(
          (entry) =>
            entry.type === "folder" && entry.parentId === parentId && entry.name === importedRoot,
        );
        if (root) setExpanded((current) => new Set(current).add(root.id));
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to import files");
    }
  }

  return (
    <div className="workspace-page">
      <header className="workspace-header">
        <a className="icon-button" href="/" aria-label="Back to workspaces" title="Home">
          <Home size={16} />
        </a>
        <WorkspaceNameEditor
          name={workspace.name}
          onCommit={(name) => apply(renameWorkspace(workspace, name))}
        />
        <span className={`save-state is-${saveState}`} aria-live="polite">
          {saveState === "saving"
            ? "Local draft · Saving…"
            : saveState === "error"
              ? "Local save failed"
              : "Local draft · Saved"}
        </span>
        <button
          className="button button-secondary workspace-files-button"
          type="button"
          onClick={() => setDrawerOpen(true)}
        >
          <Menu size={16} /> Files
        </button>
        <button
          className="button button-primary"
          type="button"
          disabled={files.length === 0}
          onClick={() => setShareOpen(true)}
        >
          <Share2 size={15} /> Share snapshot
        </button>
      </header>

      <div className="workspace-body">
        <aside className={`workspace-sidebar ${drawerOpen ? "is-open" : ""}`}>
          <div className="workspace-sidebar-heading">
            <span>Files</span>
            <button
              className="icon-button workspace-sidebar-close"
              type="button"
              aria-label="Close files"
              onClick={() => setDrawerOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
          <div className="workspace-tree-actions">
            <button type="button" onClick={() => setDialog({ kind: "new-file" })}>
              <FilePlus2 size={14} /> File
            </button>
            <button type="button" onClick={() => setDialog({ kind: "new-folder" })}>
              <FolderPlus size={14} /> Folder
            </button>
            <button type="button" onClick={() => fileInput.current?.click()}>
              <Upload size={14} /> Import
            </button>
            <button type="button" onClick={() => folderInput.current?.click()}>
              <FolderUp size={14} /> Folder
            </button>
          </div>
          <WorkspaceTree
            workspace={workspace}
            selectedId={selectedId}
            expanded={expanded}
            onSelect={(entry) => {
              setSelectedId(entry.id);
              setDrawerOpen(false);
            }}
            onToggle={(entryId) =>
              setExpanded((current) => {
                const next = new Set(current);
                if (next.has(entryId)) next.delete(entryId);
                else next.add(entryId);
                return next;
              })
            }
          />
        </aside>

        {drawerOpen ? (
          <button
            className="drawer-scrim workspace-drawer-scrim"
            type="button"
            aria-label="Close files"
            onClick={() => setDrawerOpen(false)}
          />
        ) : null}

        <main className="workspace-content">
          {selected ? (
            <EntryView
              key={selected.id}
              workspace={workspace}
              entry={selected}
              onChange={apply}
              onError={setMessage}
              onRename={() => setDialog({ kind: "rename", entry: selected })}
              onDelete={() => setDialog({ kind: "delete", entry: selected })}
            />
          ) : (
            <WorkspaceEmpty
              onCreateFile={() => setDialog({ kind: "new-file" })}
              onAddFiles={() => fileInput.current?.click()}
            />
          )}
        </main>
      </div>

      {message ? (
        <div className="workspace-toast" role="alert">
          {message}
          <button type="button" aria-label="Dismiss" onClick={() => setMessage(null)}>
            <X size={14} />
          </button>
        </div>
      ) : null}

      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        multiple
        onChange={(event) => {
          if (event.target.files) addImportedFiles(event.target.files, false);
          event.target.value = "";
        }}
      />
      <input
        ref={folderInput}
        className="visually-hidden"
        type="file"
        multiple
        webkitdirectory=""
        onChange={(event) => {
          if (event.target.files) addImportedFiles(event.target.files, true);
          event.target.value = "";
        }}
      />

      {shareOpen ? (
        <SharePublisher workspace={workspace} onClose={() => setShareOpen(false)} />
      ) : null}

      {dialog?.kind === "new-file" ? (
        <ActionDialog
          title="New file"
          description="The file will be created in the selected folder and saved locally."
          inputLabel="File name"
          initialValue="README.md"
          confirmLabel="Create file"
          onClose={() => setDialog(null)}
          onConfirm={createFile}
        />
      ) : null}
      {dialog?.kind === "new-folder" ? (
        <ActionDialog
          title="New folder"
          description="The folder will be created inside the current location."
          inputLabel="Folder name"
          initialValue="docs"
          confirmLabel="Create folder"
          onClose={() => setDialog(null)}
          onConfirm={createFolder}
        />
      ) : null}
      {dialog?.kind === "rename" ? (
        <ActionDialog
          title={`Rename “${dialog.entry.name}”`}
          description="Paths in the next published snapshot will use the new name."
          inputLabel="Name"
          initialValue={dialog.entry.name}
          confirmLabel="Rename"
          onClose={() => setDialog(null)}
          onConfirm={(name) => {
            try {
              apply(renameEntry(workspace, dialog.entry.id, name));
              setDialog(null);
            } catch (caught) {
              throw caught instanceof Error ? caught : new Error("Unable to rename item");
            }
          }}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <ActionDialog
          title={`Delete “${dialog.entry.name}”?`}
          description={
            dialog.entry.type === "folder"
              ? "This permanently removes the folder and everything inside it from this local workspace."
              : "This permanently removes the file from this local workspace."
          }
          confirmLabel={dialog.entry.type === "folder" ? "Delete folder" : "Delete file"}
          danger
          onClose={() => setDialog(null)}
          onConfirm={() => {
            try {
              apply(deleteEntry(workspace, dialog.entry.id));
              setSelectedId(null);
              setDialog(null);
            } catch (caught) {
              throw caught instanceof Error ? caught : new Error("Unable to delete item");
            }
          }}
        />
      ) : null}
    </div>
  );
}

function WorkspaceTree({
  workspace,
  selectedId,
  expanded,
  onSelect,
  onToggle,
}: {
  workspace: Workspace;
  selectedId: string | null;
  expanded: Set<string>;
  onSelect: (entry: WorkspaceEntry) => void;
  onToggle: (id: string) => void;
}): React.JSX.Element {
  const tree = useMemo(() => buildWorkspaceTree(workspace), [workspace]);
  if (tree.length === 0) {
    return <p className="workspace-tree-empty">Create a file or add files to begin.</p>;
  }
  return (
    <div className="tree workspace-tree" role="tree" aria-label="Workspace files">
      <WorkspaceTreeNodes
        nodes={tree}
        depth={0}
        selectedId={selectedId}
        expanded={expanded}
        onSelect={onSelect}
        onToggle={onToggle}
      />
    </div>
  );
}

function WorkspaceTreeNodes({
  nodes,
  depth,
  selectedId,
  expanded,
  onSelect,
  onToggle,
}: {
  nodes: WorkspaceTreeNode[];
  depth: number;
  selectedId: string | null;
  expanded: Set<string>;
  onSelect: (entry: WorkspaceEntry) => void;
  onToggle: (id: string) => void;
}): React.JSX.Element {
  return (
    <div role={depth === 0 ? "presentation" : "group"}>
      {nodes.map(({ entry, children }) => {
        const paddingInlineStart = 9 + depth * 16;
        if (entry.type === "folder") {
          const isExpanded = expanded.has(entry.id);
          return (
            <div key={entry.id}>
              <div
                className={`workspace-tree-folder ${selectedId === entry.id ? "is-selected" : ""}`}
              >
                <button
                  className="tree-row tree-folder"
                  role="treeitem"
                  aria-expanded={isExpanded}
                  aria-selected={selectedId === entry.id}
                  type="button"
                  onClick={() => {
                    onSelect(entry);
                    onToggle(entry.id);
                  }}
                  title={entry.name}
                  style={{ paddingInlineStart }}
                >
                  <span className="tree-chevron" aria-hidden="true">
                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </span>
                  <Folder size={15} />
                  <span className="tree-path">{entry.name}</span>
                </button>
              </div>
              {isExpanded ? (
                <WorkspaceTreeNodes
                  nodes={children}
                  depth={depth + 1}
                  selectedId={selectedId}
                  expanded={expanded}
                  onSelect={onSelect}
                  onToggle={onToggle}
                />
              ) : null}
            </div>
          );
        }
        return (
          <button
            className={`tree-row tree-file ${selectedId === entry.id ? "is-selected" : ""}`}
            role="treeitem"
            aria-selected={selectedId === entry.id}
            type="button"
            key={entry.id}
            onClick={() => onSelect(entry)}
            title={entry.name}
            style={{ paddingInlineStart: paddingInlineStart + 21 }}
          >
            <WorkspaceFileIcon entry={entry} />
            <span className="tree-path">{entry.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function EntryView({
  workspace,
  entry,
  onChange,
  onError,
  onRename,
  onDelete,
}: {
  workspace: Workspace;
  entry: WorkspaceEntry;
  onChange: (workspace: Workspace) => void;
  onError: (message: string) => void;
  onRename: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  const options = folderOptions(workspace, entry.id);
  return (
    <div className="workspace-entry-view">
      <div className="entry-toolbar">
        <div className="entry-identity">
          {entry.type === "folder" ? <Folder size={16} /> : <WorkspaceFileIcon entry={entry} />}
          <div>
            <strong>{entry.name}</strong>
            <span>{pathForEntry(workspace, entry.id)}</span>
          </div>
        </div>
        <div className="entry-actions">
          <label>
            <span>Move to</span>
            <select
              value={entry.parentId ?? "root"}
              onChange={(event) => {
                try {
                  onChange(
                    moveEntry(
                      workspace,
                      entry.id,
                      event.target.value === "root" ? null : event.target.value,
                    ),
                  );
                } catch (caught) {
                  onError(caught instanceof Error ? caught.message : "Unable to move item");
                }
              }}
            >
              {options.map((option) => (
                <option key={option.id ?? "root"} value={option.id ?? "root"}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="icon-button" type="button" onClick={onRename} aria-label="Rename">
            <Pencil size={15} />
          </button>
          <button
            className="icon-button danger-action"
            type="button"
            onClick={onDelete}
            aria-label="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {entry.type === "file" ? (
        <WorkspaceFileView
          entry={entry}
          onContentChange={(content) => onChange(updateFileContent(workspace, entry.id, content))}
        />
      ) : (
        <div className="folder-summary">
          <Folder size={28} />
          <h2>{entry.name}</h2>
          <p>
            {workspace.entries.filter((candidate) => candidate.parentId === entry.id).length} direct
            items
          </p>
        </div>
      )}
    </div>
  );
}

function WorkspaceFileView({
  entry,
  onContentChange,
}: {
  entry: Extract<WorkspaceEntry, { type: "file" }>;
  onContentChange: (content: string) => void;
}): React.JSX.Element {
  const kind = filePreviewKind(entry.name, entry.mimeType);
  const [sourceBlob] = useState(entry.blob);
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">(kind === "markdown" ? "edit" : "preview");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (kind === "markdown" || kind === "text") {
      void sourceBlob.text().then((value) => {
        if (active) setContent(value);
      });
    }
    if (kind === "image") {
      const url = URL.createObjectURL(sourceBlob);
      setImageUrl(url);
      return () => {
        active = false;
        URL.revokeObjectURL(url);
      };
    }
    return () => {
      active = false;
    };
  }, [kind, sourceBlob]);

  useEffect(() => {
    if (kind === "markdown") setMode("edit");
  }, [kind]);

  if (kind === "markdown") {
    return (
      <div className="workspace-editor-panel">
        <div className="editor-tabs" role="tablist" aria-label="Markdown mode">
          <button
            className={mode === "edit" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={mode === "edit"}
            onClick={() => setMode("edit")}
          >
            Edit
          </button>
          <button
            className={mode === "preview" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={mode === "preview"}
            onClick={() => setMode("preview")}
          >
            Preview
          </button>
        </div>
        {mode === "edit" ? (
          <TextEditor content={content} onChange={setContent} onPersist={onContentChange} />
        ) : (
          <div className="workspace-markdown-preview">
            <MarkdownPreview content={content} />
          </div>
        )}
      </div>
    );
  }

  if (kind === "text") {
    return (
      <div className="workspace-editor-panel">
        <TextEditor content={content} onChange={setContent} onPersist={onContentChange} />
      </div>
    );
  }

  if (kind === "image" && imageUrl) {
    return (
      <div className="workspace-image-preview">
        <img src={imageUrl} alt={entry.name} />
      </div>
    );
  }

  return (
    <div className="workspace-binary-preview">
      <File size={30} />
      <h2>{entry.name}</h2>
      <p>
        {entry.mimeType} · {formatBytes(entry.blob.size)}
      </p>
      <p>This file can be stored and shared but is not editable here.</p>
      <button
        className="button button-secondary"
        type="button"
        onClick={() => downloadBlob(entry.blob, entry.name)}
      >
        <Download size={15} /> Open or download
      </button>
    </div>
  );
}

function TextEditor({
  content,
  onChange,
  onPersist,
}: {
  content: string;
  onChange: (value: string) => void;
  onPersist: (value: string) => void;
}): React.JSX.Element {
  const timeout = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timeout.current !== null) window.clearTimeout(timeout.current);
    },
    [],
  );
  return (
    <textarea
      className="workspace-text-editor"
      value={content}
      aria-label="File content"
      spellCheck={false}
      onChange={(event) => {
        const value = event.target.value;
        onChange(value);
        if (timeout.current !== null) window.clearTimeout(timeout.current);
        timeout.current = window.setTimeout(() => onPersist(value), 250);
      }}
      onBlur={() => {
        if (timeout.current !== null) window.clearTimeout(timeout.current);
        timeout.current = null;
        onPersist(content);
      }}
    />
  );
}

function WorkspaceNameEditor({
  name,
  onCommit,
}: {
  name: string;
  onCommit: (name: string) => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState(name);
  return (
    <input
      className="workspace-name-input"
      value={draft}
      aria-label="Workspace name"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = draft.trim() || "Untitled";
        setDraft(next);
        if (next !== name) onCommit(next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function WorkspaceEmpty({
  onCreateFile,
  onAddFiles,
}: {
  onCreateFile: () => void;
  onAddFiles: () => void;
}): React.JSX.Element {
  return (
    <div className="workspace-empty">
      <FilePlus2 size={28} />
      <h1>Choose a file or make a new one</h1>
      <p>Everything here is stored locally until you create an encrypted share.</p>
      <div>
        <button className="button button-primary" type="button" onClick={onCreateFile}>
          New file
        </button>
        <button className="button button-secondary" type="button" onClick={onAddFiles}>
          Add files
        </button>
      </div>
    </div>
  );
}

function WorkspaceFileIcon({
  entry,
}: {
  entry: Extract<WorkspaceEntry, { type: "file" }>;
}): React.JSX.Element {
  const kind = filePreviewKind(entry.name, entry.mimeType);
  if (kind === "image") return <FileImage size={15} />;
  if (kind === "markdown") return <FileText size={15} />;
  if (kind === "text") return <FileCode2 size={15} />;
  return <File size={15} />;
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
