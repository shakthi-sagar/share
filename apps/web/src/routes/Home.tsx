import { Copy, FilePlus2, FileUp, FolderInput, FolderOpen, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

export function Home(): React.JSX.Element {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    const name = folder ? (firstPath.split("/")[0] ?? "Untitled") : selected[0]?.file.name;
    const workspace = importFiles(createWorkspace(name), selected, null, folder);
    await openNewWorkspace(workspace);
  }

  async function refresh(): Promise<void> {
    setWorkspaces(await workspaceStore.list());
  }

  return (
    <main className="home-shell workspace-home">
      <section className="hero-copy workspace-hero">
        <p className="eyebrow">Local-first encrypted sharing</p>
        <h1>Build locally. Share a snapshot.</h1>
        <p>Your workspace stays in this browser until you explicitly encrypt and share it.</p>
      </section>

      <section className="workspace-start" aria-labelledby="start-heading">
        <div className="section-heading">
          <div>
            <h2 id="start-heading">Start a workspace</h2>
            <p>Files are stored locally on this device.</p>
          </div>
          <span className="local-badge">Local only</span>
        </div>
        <div className="start-actions">
          <button
            className="start-action"
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <span className="start-action-icon">
              <FileUp size={20} />
            </span>
            <strong>Upload file</strong>
            <span>Open one file in a new workspace</span>
          </button>
          <button
            className="start-action"
            type="button"
            disabled={busy}
            onClick={() => folderInput.current?.click()}
          >
            <span className="start-action-icon">
              <FolderInput size={20} />
            </span>
            <strong>Upload folder</strong>
            <span>Keep its nested folder structure</span>
          </button>
          <button
            className="start-action"
            type="button"
            disabled={busy}
            onClick={() => void openNewWorkspace(createWorkspace())}
          >
            <span className="start-action-icon">
              <FilePlus2 size={20} />
            </span>
            <strong>Create empty workspace</strong>
            <span>Start with a blank local canvas</span>
          </button>
        </div>
      </section>

      <section className="recent-workspaces" aria-labelledby="recent-heading">
        <div className="section-heading">
          <div>
            <h2 id="recent-heading">Recent workspaces</h2>
            <p>Stored in IndexedDB in this browser.</p>
          </div>
        </div>

        {loading ? <p className="empty-library">Loading local workspaces…</p> : null}
        {!loading && workspaces.length === 0 ? (
          <div className="empty-library">
            <FolderOpen size={20} />
            <p>No local workspaces yet.</p>
          </div>
        ) : null}
        {workspaces.length > 0 ? (
          <ul className="workspace-list">
            {workspaces.map((workspace) => {
              const files = workspaceFiles(workspace);
              return (
                <li key={workspace.id}>
                  <a className="workspace-list-main" href={`/w/${workspace.id}`}>
                    <span className="workspace-list-name">{workspace.name}</span>
                    <span>
                      {files.length} {files.length === 1 ? "file" : "files"} ·{" "}
                      {formatBytes(files.reduce((total, { entry }) => total + entry.blob.size, 0))}
                    </span>
                    <span>Edited {formatRelativeTime(workspace.updatedAt)}</span>
                  </a>
                  <div className="workspace-list-actions">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Rename ${workspace.name}`}
                      title="Rename"
                      onClick={async () => {
                        const name = window.prompt("Workspace name", workspace.name);
                        if (!name?.trim()) return;
                        await workspaceStore.update(renameWorkspace(workspace, name));
                        await refresh();
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Duplicate ${workspace.name}`}
                      title="Duplicate"
                      onClick={async () => {
                        await workspaceStore.create(duplicateWorkspace(workspace));
                        await refresh();
                      }}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Delete ${workspace.name}`}
                      title="Delete"
                      onClick={async () => {
                        if (!window.confirm(`Delete “${workspace.name}” from this browser?`))
                          return;
                        await workspaceStore.delete(workspace.id);
                        await refresh();
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
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
    </main>
  );
}

function formatRelativeTime(timestamp: number): string {
  const difference = Date.now() - timestamp;
  const minutes = Math.floor(difference / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}
