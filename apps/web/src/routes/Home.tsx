import {
  Copy,
  FilePlus2,
  FileUp,
  FolderInput,
  FolderOpen,
  HardDrive,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ActionDialog } from "../components/ActionDialog";
import { formatBytes } from "../lib/format";
import {
  createWorkspace,
  duplicateWorkspace,
  importFiles,
  renameWorkspace,
  workspaceFiles,
} from "../workspace/model";
import { workspaceStore } from "../workspace/store";
import type { Workspace, WorkspaceImportFile } from "../workspace/types";

type HomeDialog = { kind: "rename" | "delete"; workspace: Workspace } | null;

export function Home(): React.JSX.Element {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<HomeDialog>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void workspaceStore
      .list()
      .then((items) => {
        if (active) setWorkspaces(items);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load local workspaces");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function openNewWorkspace(workspace: Workspace): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await workspaceStore.create(workspace);
      window.location.assign(`/w/${workspace.id}`);
    } catch (caught) {
      setBusy(false);
      setError(caught instanceof Error ? caught.message : "Unable to create workspace");
    }
  }

  async function createFromFiles(files: FileList, folder: boolean): Promise<void> {
    const selected: WorkspaceImportFile[] = [...files].map((file) => ({
      file,
      path: file.webkitRelativePath || file.name,
    }));
    if (selected.length === 0) return;
    const firstPath = selected[0]?.path ?? "Untitled";
    const name = folder
      ? (firstPath.split("/")[0] ?? "Untitled")
      : selected.length === 1
        ? (selected[0]?.file.name ?? "Untitled")
        : "Untitled workspace";
    const workspace = importFiles(createWorkspace(name), selected, null, folder);
    await openNewWorkspace(workspace);
  }

  async function refresh(): Promise<void> {
    setWorkspaces(await workspaceStore.list());
  }

  return (
    <main className="home-shell workspace-home">
      <section className="workspace-intro">
        <h1>Encrypted file sharing, simplified.</h1>
        <p>
          Organize files locally in your browser, then publish an immutable encrypted snapshot when
          it is ready.
        </p>
      </section>

      <section className="workspace-launch" aria-labelledby="start-heading">
        <div className="workspace-launch-heading">
          <h2 id="start-heading">Start a workspace</h2>
          <span className="local-badge">
            <HardDrive size={12} aria-hidden="true" /> Local only
          </span>
        </div>

        <button
          className={`workspace-dropzone ${dragging ? "is-dragging" : ""}`}
          type="button"
          aria-label="Drop files to create a workspace"
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files.length > 0) {
              void createFromFiles(event.dataTransfer.files, false);
            }
          }}
        >
          <span className="dropzone-symbol" aria-hidden="true">
            <FileUp size={24} />
          </span>
          <span>
            <strong>Drop files here</strong>
            <span>or choose how to start</span>
          </span>
        </button>

        <div className="workspace-launch-actions">
          <button
            className="button button-primary"
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <FileUp size={16} /> Choose files
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={() => folderInput.current?.click()}
          >
            <FolderInput size={16} /> Choose folder
          </button>
          <button
            className="button button-quiet"
            type="button"
            disabled={busy}
            onClick={() => void openNewWorkspace(createWorkspace())}
          >
            <FilePlus2 size={16} /> Start empty
          </button>
        </div>

        <p className="workspace-launch-note">
          <ShieldCheck size={14} aria-hidden="true" /> Files stay in this browser until you publish
          an encrypted snapshot.
        </p>
      </section>

      <section className="recent-workspaces" aria-labelledby="recent-heading">
        <div className="section-heading workspace-library-heading">
          <h2 id="recent-heading">
            {loading
              ? "Workspaces"
              : `${workspaces.length} local workspace${workspaces.length === 1 ? "" : "s"}`}
          </h2>
        </div>

        {loading ? (
          <p className="empty-library">Loading local workspaces…</p>
        ) : workspaces.length === 0 ? (
          <div className="empty-library">
            <FolderOpen size={22} />
            <div>
              <strong>No workspaces yet</strong>
              <p>Drop files above or start with an empty workspace.</p>
            </div>
          </div>
        ) : (
          <div className="workspace-table">
            <div className="workspace-table-head" aria-hidden="true">
              <span>Name</span>
              <span>Contents</span>
              <span>Modified</span>
              <span />
            </div>
            <ul className="workspace-list">
              {workspaces.map((workspace) => {
                const files = workspaceFiles(workspace);
                const totalSize = files.reduce((total, { entry }) => total + entry.blob.size, 0);
                return (
                  <li key={workspace.id}>
                    <a className="workspace-list-main" href={`/w/${workspace.id}`}>
                      <span className="workspace-list-name">{workspace.name}</span>
                      <span>
                        {files.length} {files.length === 1 ? "file" : "files"} ·{" "}
                        {formatBytes(totalSize)}
                      </span>
                      <span>{formatRelativeTime(workspace.updatedAt)}</span>
                    </a>
                    <div className="workspace-list-actions">
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Rename ${workspace.name}`}
                        title="Rename"
                        onClick={() => setDialog({ kind: "rename", workspace })}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Duplicate ${workspace.name}`}
                        title="Duplicate"
                        onClick={async () => {
                          try {
                            await workspaceStore.create(duplicateWorkspace(workspace));
                            await refresh();
                          } catch (caught) {
                            setError(
                              caught instanceof Error
                                ? caught.message
                                : "Unable to duplicate workspace",
                            );
                          }
                        }}
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        className="icon-button danger-action"
                        type="button"
                        aria-label={`Delete ${workspace.name}`}
                        title="Delete"
                        onClick={() => setDialog({ kind: "delete", workspace })}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}

      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        multiple
        onChange={(event) => {
          if (event.target.files) void createFromFiles(event.target.files, false);
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
          if (event.target.files) void createFromFiles(event.target.files, true);
          event.target.value = "";
        }}
      />

      {dialog?.kind === "rename" ? (
        <ActionDialog
          title="Rename workspace"
          description="This changes the local workspace name only."
          inputLabel="Workspace name"
          initialValue={dialog.workspace.name}
          confirmLabel="Rename"
          onClose={() => setDialog(null)}
          onConfirm={async (name) => {
            try {
              await workspaceStore.update(renameWorkspace(dialog.workspace, name));
              await refresh();
            } catch (caught) {
              throw caught instanceof Error ? caught : new Error("Unable to rename workspace");
            }
          }}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <ActionDialog
          title={`Delete “${dialog.workspace.name}”?`}
          description="This permanently removes the workspace and all its files from this browser."
          confirmLabel="Delete workspace"
          danger
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            try {
              await workspaceStore.delete(dialog.workspace.id);
              await refresh();
            } catch (caught) {
              throw caught instanceof Error ? caught : new Error("Unable to delete workspace");
            }
          }}
        />
      ) : null}
    </main>
  );
}

function formatRelativeTime(value: number): string {
  const seconds = Math.floor((Date.now() - value) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
