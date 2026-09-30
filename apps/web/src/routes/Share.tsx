import type { UnlockedShare } from "@share/client";
import { ApiError, unlockEncryptedShare } from "@share/client";
import { displayPath, type ManifestFile } from "@share/protocol";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Folder,
  KeyRound,
  LockKeyhole,
  Menu,
  X,
} from "lucide-react";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CopyButton } from "../components/CopyButton";
import { Header } from "../components/Header";
import { API_BASE_URL } from "../lib/config";
import { describeShareError } from "../lib/errors";
import { type BundleTreeNode, buildFileTree, directoryPaths } from "../lib/file-tree";
import { formatBytes } from "../lib/format";
import { keyFromInput } from "../lib/share-key";
import {
  BlobPreview,
  DownloadOnly,
  type LoadedPreview,
  ModeSwitch,
  modesFor,
  type PreviewMode,
  RenderedText,
  SourceText,
  useLoadedPreview,
  useWideLayout,
} from "../preview/FilePreview";
import { KindIcon } from "../preview/KindIcon";
import { hasRenderedView, previewKind } from "../preview/kinds";
import { SplitView } from "../preview/SplitView";

export function Share({ id }: { id: string }): React.JSX.Element {
  const fragmentKey = new URLSearchParams(window.location.hash.slice(1)).get("k");
  const [key, setKey] = useState(fragmentKey ?? "");
  const [share, setShare] = useState<UnlockedShare | null>(null);
  const [status, setStatus] = useState<"locked" | "unlocking" | "error">(
    fragmentKey ? "unlocking" : "locked",
  );
  const [message, setMessage] = useState<string | null>(null);

  const unlock = useCallback(
    async (candidate: string): Promise<void> => {
      setStatus("unlocking");
      setMessage(null);
      try {
        const unlocked = await unlockEncryptedShare({
          apiBaseUrl: API_BASE_URL,
          id,
          key: candidate,
        });
        setShare(unlocked);
      } catch (caught) {
        setStatus("error");
        setMessage(
          caught instanceof ApiError && caught.status === 404
            ? "This key does not unlock the share, or the share expired or was revoked."
            : describeShareError(caught, "Unable to unlock this share."),
        );
      } finally {
        // The key must not stay in the address bar, history, or a bookmark once it has been read.
        if (window.location.hash) {
          window.history.replaceState(null, "", `/s/${id}`);
        }
      }
    },
    [id],
  );

  useEffect(() => {
    if (fragmentKey) {
      void unlock(fragmentKey);
    }
  }, [fragmentKey, unlock]);

  if (share) {
    return <ShareViewer share={share} />;
  }

  const unlockingFromLink = status === "unlocking" && fragmentKey !== null;

  return (
    <div className="unlock-page">
      <Header />
      <main className="unlock-main">
        <div className="unlock-mark" aria-hidden="true">
          <KeyRound size={20} strokeWidth={1.6} />
        </div>
        {unlockingFromLink ? (
          <div className="unlock-progress" role="status">
            <h1>Decrypting snapshot</h1>
            <p>Checking the key and decrypting the file list in this browser…</p>
          </div>
        ) : (
          <>
            <h1>Unlock encrypted snapshot</h1>
            <p>
              Paste the key or the full link from the sender. Decryption happens in this browser.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void unlock(keyFromInput(key));
              }}
            >
              <label htmlFor="decryption-key">Key or full link</label>
              <input
                id="decryption-key"
                name="decryption-key"
                type="password"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={status === "error"}
                aria-describedby={message ? "unlock-error" : "key-note"}
              />
              <button
                className="button button-primary unlock-submit"
                type="submit"
                disabled={!key.trim() || status === "unlocking"}
              >
                {status === "unlocking" ? "Unlocking…" : "Unlock"}
              </button>
            </form>
            {message ? (
              <p className="unlock-error" id="unlock-error" role="alert">
                {message}
              </p>
            ) : null}
          </>
        )}
        <p className="unlock-note" id="key-note">
          The service receives a separate access credential derived from the key, never the key or
          the decrypted files.
        </p>
      </main>
    </div>
  );
}

function ShareViewer({ share }: { share: UnlockedShare }): React.JSX.Element {
  const [selected, setSelected] = useState<ManifestFile | null>(share.manifest.files[0] ?? null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const totalSize = share.manifest.files.reduce((total, file) => total + file.size, 0);
  const name = displayPath(share.manifest.name);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  return (
    <div className="viewer-page">
      <header className="viewer-header">
        <a className="wordmark" href="/" aria-label="Share home">
          <span className="wordmark-mark" aria-hidden="true">
            /
          </span>
          share
        </a>
        <span className="viewer-bundle-name" title={name}>
          {name}
        </span>
        <span className="encrypted-status" title="Decrypted in this browser">
          <LockKeyhole size={13} aria-hidden="true" /> End-to-end encrypted
        </span>
        <div className="viewer-actions">
          <button
            className="button button-secondary mobile-tree-button"
            type="button"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={16} aria-hidden="true" /> Files
          </button>
        </div>
      </header>
      <div className="viewer-body">
        <aside className={`file-sidebar ${drawerOpen ? "is-open" : ""}`} aria-label="Files">
          <div className="sidebar-heading">
            <span>
              Files{" "}
              <small>
                {share.manifest.files.length} · {formatBytes(totalSize)}
              </small>
            </span>
            <button
              className="icon-button sidebar-close"
              type="button"
              aria-label="Close files"
              onClick={() => setDrawerOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
          <FileTree
            files={share.manifest.files}
            selected={selected}
            onSelect={(file) => {
              setSelected(file);
              setDrawerOpen(false);
            }}
          />
        </aside>
        {drawerOpen ? (
          <button
            className="drawer-scrim"
            type="button"
            aria-label="Close files"
            onClick={() => setDrawerOpen(false)}
          />
        ) : null}
        <main className="content-pane">
          {selected ? (
            <FileView key={selected.id} share={share} file={selected} />
          ) : (
            <EmptyBundle />
          )}
        </main>
      </div>
    </div>
  );
}

function FileTree({
  files,
  selected,
  onSelect,
}: {
  files: ManifestFile[];
  selected: ManifestFile | null;
  onSelect: (file: ManifestFile) => void;
}): React.JSX.Element {
  const tree = useMemo(() => buildFileTree(files), [files]);
  const [expanded, setExpanded] = useState(() => new Set(directoryPaths(tree)));
  const toggle = (path: string, open?: boolean): void =>
    setExpanded((current) => {
      const next = new Set(current);
      if (open ?? !next.has(path)) next.add(path);
      else next.delete(path);
      return next;
    });

  return (
    <div
      className="tree"
      role="tree"
      aria-label="Snapshot files"
      onKeyDown={(event) => handleTreeKeyDown(event, expanded, toggle)}
    >
      <TreeNodes
        nodes={tree}
        depth={0}
        expanded={expanded}
        selected={selected}
        onSelect={onSelect}
        onToggle={toggle}
      />
    </div>
  );
}

/**
 * Arrow keys move between visible rows, Home and End jump to the ends, and Right and Left open and
 * close a folder, following the WAI-ARIA tree pattern.
 */
function handleTreeKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  expanded: Set<string>,
  toggle: (path: string, open?: boolean) => void,
): void {
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"]')];
  const current = document.activeElement as HTMLElement | null;
  const index = current ? items.indexOf(current) : -1;
  if (index === -1) return;
  const folderPath = current?.dataset.folderPath;
  const move = (target: number): void => {
    event.preventDefault();
    items[Math.max(0, Math.min(items.length - 1, target))]?.focus();
  };

  switch (event.key) {
    case "ArrowDown":
      move(index + 1);
      break;
    case "ArrowUp":
      move(index - 1);
      break;
    case "Home":
      move(0);
      break;
    case "End":
      move(items.length - 1);
      break;
    case "ArrowRight":
      if (folderPath) {
        event.preventDefault();
        if (expanded.has(folderPath)) move(index + 1);
        else toggle(folderPath, true);
      }
      break;
    case "ArrowLeft":
      if (folderPath && expanded.has(folderPath)) {
        event.preventDefault();
        toggle(folderPath, false);
      }
      break;
  }
}

function TreeNodes({
  nodes,
  depth,
  expanded,
  selected,
  onSelect,
  onToggle,
}: {
  nodes: BundleTreeNode[];
  depth: number;
  expanded: Set<string>;
  selected: ManifestFile | null;
  onSelect: (file: ManifestFile) => void;
  onToggle: (path: string) => void;
}): React.JSX.Element {
  return (
    <div role={depth === 0 ? "presentation" : "group"}>
      {nodes.map((node) => {
        const paddingInlineStart = 9 + depth * 16;
        const label = displayPath(node.name);
        if (node.kind === "directory") {
          const isExpanded = expanded.has(node.path);
          return (
            <div key={node.path}>
              <button
                className="tree-row tree-folder"
                role="treeitem"
                aria-expanded={isExpanded}
                type="button"
                data-folder-path={node.path}
                onClick={() => onToggle(node.path)}
                title={displayPath(node.path)}
                style={{ paddingInlineStart }}
              >
                <span className="tree-chevron" aria-hidden="true">
                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
                <Folder size={15} aria-hidden="true" />
                <span className="tree-path">{label}</span>
              </button>
              {isExpanded ? (
                <TreeNodes
                  nodes={node.children}
                  depth={depth + 1}
                  expanded={expanded}
                  selected={selected}
                  onSelect={onSelect}
                  onToggle={onToggle}
                />
              ) : null}
            </div>
          );
        }

        const isSelected = selected?.id === node.file.id;
        return (
          <button
            className={`tree-row tree-file ${isSelected ? "is-selected" : ""}`}
            role="treeitem"
            aria-selected={isSelected}
            type="button"
            key={node.file.id}
            onClick={() => onSelect(node.file)}
            title={displayPath(node.path)}
            style={{ paddingInlineStart }}
          >
            <span className="tree-chevron" aria-hidden="true" />
            <FileIcon file={node.file} />
            <span className="tree-path">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The selected file: its identity and actions, then its decrypted preview. */
function FileView({
  share,
  file,
}: {
  share: UnlockedShare;
  file: ManifestFile;
}): React.JSX.Element {
  const loaded = useLoadedPreview(
    file,
    () => new Response(share.openFile(file)).blob(),
    (error) => describeShareError(error, "Unable to open file"),
  );
  const wide = useWideLayout();
  const kind = loaded.status === "ready" ? loaded.kind : previewKind(file.path, file.mime);
  const modes = modesFor(kind, wide);
  const [preferred, setPreferred] = useState<PreviewMode>("rendered");
  const mode = modes.includes(preferred) ? preferred : "rendered";
  const segments = file.path.split("/");
  const fileName = displayPath(segments.at(-1) ?? file.path);
  const folder = segments.length > 1 ? displayPath(segments.slice(0, -1).join("/")) : null;
  const text = loaded.status === "ready" ? loaded.text : null;

  return (
    <div className="viewer-file-view">
      <div className="viewer-file-header">
        <FileIcon file={file} />
        <div className="viewer-file-identity">
          <strong title={displayPath(file.path)}>{fileName}</strong>
          <span>
            {folder ? `${folder} · ` : null}
            {formatBytes(file.size)}
          </span>
        </div>
        <div className="viewer-file-actions">
          {text !== null ? <ModeSwitch modes={modes} mode={mode} onChange={setPreferred} /> : null}
          {text !== null ? <CopyButton value={text} label="Copy" /> : null}
          <DownloadButton share={share} file={file} />
        </div>
      </div>
      <div className="viewer-file-content">
        <FileBody loaded={loaded} file={file} fileName={fileName} mode={mode} share={share} />
      </div>
    </div>
  );
}

function FileBody({
  loaded,
  file,
  fileName,
  mode,
  share,
}: {
  loaded: LoadedPreview;
  file: ManifestFile;
  fileName: string;
  mode: PreviewMode;
  share: UnlockedShare;
}): React.JSX.Element {
  if (loaded.status === "loading") {
    return (
      <div className="content-state" role="status">
        <Eye size={18} aria-hidden="true" /> Decrypting {fileName}…
      </div>
    );
  }
  if (loaded.status === "error") {
    return (
      <div className="content-state error-state" role="alert">
        {loaded.message}
      </div>
    );
  }
  if (loaded.status === "download") {
    return (
      <DownloadOnly
        reason={loaded.reason}
        name={fileName}
        size={file.size}
        action={<DownloadButton share={share} file={file} />}
      />
    );
  }
  if (loaded.text === null) {
    return (
      <BlobPreview
        kind={loaded.kind}
        blob={loaded.blob}
        path={file.path}
        mime={file.mime}
        name={fileName}
      />
    );
  }
  const rendered = (
    <RenderedText kind={loaded.kind} text={loaded.text} path={file.path} name={fileName} />
  );
  const source = <SourceText kind={loaded.kind} text={loaded.text} path={file.path} />;
  if (!hasRenderedView(loaded.kind) || mode === "source") return source;
  if (mode === "split") {
    return <SplitView left={source} right={rendered} leftLabel="Source" rightLabel="Preview" />;
  }
  return rendered;
}

function DownloadButton({
  share,
  file,
}: {
  share: UnlockedShare;
  file: ManifestFile;
}): React.JSX.Element {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileName = displayPath(file.path.split("/").at(-1) ?? "download");
  return (
    <>
      <button
        className="button button-secondary viewer-download"
        type="button"
        disabled={downloading}
        aria-label={`Download ${fileName}`}
        onClick={async () => {
          setDownloading(true);
          setError(null);
          try {
            const blob = await new Response(share.openFile(file), {
              headers: { "Content-Type": file.mime },
            }).blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = fileName;
            anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 0);
          } catch (caught) {
            setError(describeShareError(caught, "The download failed"));
          } finally {
            setDownloading(false);
          }
        }}
      >
        <Download size={15} aria-hidden="true" />
        <span className="button-label">{downloading ? "Decrypting…" : "Download"}</span>
      </button>
      {error ? (
        <span className="viewer-download-error" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}

function FileIcon({ file }: { file: ManifestFile }): React.JSX.Element {
  return <KindIcon kind={previewKind(file.path, file.mime)} />;
}

function EmptyBundle(): React.JSX.Element {
  return (
    <div className="content-state">
      <Folder size={18} aria-hidden="true" /> This snapshot contains no files.
    </div>
  );
}
