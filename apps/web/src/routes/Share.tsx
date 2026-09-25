import type { UnlockedShare } from "@share/client";
import { ApiError, unlockEncryptedShare } from "@share/client";
import type { ManifestFile } from "@share/protocol";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  File,
  FileCode2,
  FileImage,
  FileText,
  Folder,
  KeyRound,
  Menu,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "../components/Header";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { API_BASE_URL } from "../lib/config";
import { filePreviewKind } from "../lib/file-kind";
import { type BundleTreeNode, buildFileTree, directoryPaths } from "../lib/file-tree";
import { formatBytes } from "../lib/format";

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
        window.history.replaceState(null, "", `/s/${id}`);
      } catch (caught) {
        setStatus("error");
        setMessage(
          caught instanceof ApiError && caught.status === 404
            ? "Unable to unlock this share. Check the key and try again."
            : caught instanceof Error
              ? caught.message
              : "Unable to unlock this share.",
        );
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

  return (
    <div className="unlock-page">
      <Header />
      <main className="unlock-main">
        <div className="unlock-mark" aria-hidden="true">
          <KeyRound size={20} strokeWidth={1.6} />
        </div>
        <h1>Encrypted share</h1>
        <p>This bundle is encrypted. Enter the key provided by the sender.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void unlock(key.trim());
          }}
        >
          <label htmlFor="decryption-key">Decryption key</label>
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
        <p className="unlock-note" id="key-note">
          The master secret is used only in this browser. The API receives a separate derived access
          credential.
        </p>
      </main>
    </div>
  );
}

function ShareViewer({ share }: { share: UnlockedShare }): React.JSX.Element {
  const [selected, setSelected] = useState<ManifestFile | null>(share.manifest.files[0] ?? null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="viewer-page">
      <header className="viewer-header">
        <a className="wordmark" href="/">
          <span className="wordmark-mark">/</span>share
        </a>
        <span className="viewer-bundle-name">{share.manifest.name}</span>
        <span className="encrypted-status">
          <KeyRound size={13} /> Encrypted
        </span>
        <div className="viewer-actions">
          <button
            className="button button-secondary mobile-tree-button"
            type="button"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={16} /> Files
          </button>
          {selected ? <DownloadButton share={share} file={selected} /> : null}
        </div>
      </header>
      <div className="viewer-body">
        <aside className={`file-sidebar ${drawerOpen ? "is-open" : ""}`}>
          <div className="sidebar-heading">
            <span>{share.manifest.name}</span>
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
          {selected ? <FilePreview share={share} file={selected} /> : <EmptyBundle />}
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

  return (
    <div className="tree" role="tree" aria-label="Bundle files">
      <TreeNodes
        nodes={tree}
        depth={0}
        expanded={expanded}
        selected={selected}
        onSelect={onSelect}
        onToggle={(path) =>
          setExpanded((current) => {
            const next = new Set(current);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
          })
        }
      />
    </div>
  );
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
        if (node.kind === "directory") {
          const isExpanded = expanded.has(node.path);
          return (
            <div key={node.path}>
              <button
                className="tree-row tree-folder"
                role="treeitem"
                aria-expanded={isExpanded}
                type="button"
                onClick={() => onToggle(node.path)}
                title={node.path}
                style={{ paddingInlineStart }}
              >
                <span className="tree-chevron" aria-hidden="true">
                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
                <Folder size={15} />
                <span className="tree-path">{node.name}</span>
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

        return (
          <button
            className={`tree-row tree-file ${selected?.id === node.file.id ? "is-selected" : ""}`}
            role="treeitem"
            aria-selected={selected?.id === node.file.id}
            type="button"
            key={node.file.id}
            onClick={() => onSelect(node.file)}
            title={node.path}
            style={{ paddingInlineStart: paddingInlineStart + 21 }}
          >
            <FileIcon file={node.file} />
            <span className="tree-path">{node.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function FilePreview({
  share,
  file,
}: {
  share: UnlockedShare;
  file: ManifestFile;
}): React.JSX.Element {
  const [content, setContent] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previewKind = filePreviewKind(file.path, file.mime);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setContent(null);
    setImageUrl(null);
    setError(null);

    if (previewKind === "binary") {
      setLoading(false);
      return;
    }

    void new Response(share.openFile(file))
      .blob()
      .then(async (blob) => {
        if (!active) return;
        if (previewKind === "image") {
          objectUrl = URL.createObjectURL(blob);
          setImageUrl(objectUrl);
        } else {
          setContent(await blob.text());
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to open file");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [share, file, previewKind]);

  if (loading) {
    return (
      <div className="content-state">
        <Eye size={18} /> Decrypting {file.path}…
      </div>
    );
  }
  if (error) {
    return <div className="content-state error-state">{error}</div>;
  }
  if (previewKind === "markdown" && content !== null) {
    return <MarkdownPreview content={content} />;
  }
  if (previewKind === "text" && content !== null) {
    return (
      <pre className="code-viewer">
        <code>{content}</code>
      </pre>
    );
  }
  if (previewKind === "image" && imageUrl) {
    return (
      <div className="image-viewer">
        <img src={imageUrl} alt={file.path} />
      </div>
    );
  }
  return (
    <div className="binary-viewer">
      <File size={30} strokeWidth={1.4} />
      <h1>{file.path.split("/").at(-1)}</h1>
      <p>{formatBytes(file.size)}</p>
      <p>This file cannot be previewed.</p>
      <DownloadButton share={share} file={file} />
    </div>
  );
}

function DownloadButton({
  share,
  file,
}: {
  share: UnlockedShare;
  file: ManifestFile;
}): React.JSX.Element {
  const [downloading, setDownloading] = useState(false);
  return (
    <button
      className="button button-secondary"
      type="button"
      disabled={downloading}
      onClick={async () => {
        setDownloading(true);
        try {
          const blob = await new Response(share.openFile(file), {
            headers: { "Content-Type": file.mime },
          }).blob();
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = file.path.split("/").at(-1) ?? "download";
          anchor.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 0);
        } finally {
          setDownloading(false);
        }
      }}
    >
      <Download size={15} /> {downloading ? "Decrypting…" : "Download"}
    </button>
  );
}

function FileIcon({ file }: { file: ManifestFile }): React.JSX.Element {
  if (file.mime.startsWith("image/")) return <FileImage size={15} />;
  if (filePreviewKind(file.path, file.mime) === "markdown") return <FileText size={15} />;
  if (filePreviewKind(file.path, file.mime) === "text") return <FileCode2 size={15} />;
  return <File size={15} />;
}

function EmptyBundle(): React.JSX.Element {
  return (
    <div className="content-state">
      <Folder size={18} /> This bundle contains no files.
    </div>
  );
}
