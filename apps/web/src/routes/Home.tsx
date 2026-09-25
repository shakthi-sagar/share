import { type CreatedShare, createEncryptedShare, type ShareProgress } from "@share/client";
import { Check, FileText, FolderOpen, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { CopyButton } from "../components/CopyButton";
import { API_BASE_URL, DEFAULT_EXPIRY_SECONDS, SHARE_BASE_URL } from "../lib/config";
import { mergeSelected, selectedFromDrop, selectedFromFileList } from "../lib/files";
import { bundleNameFromFiles, formatBytes, type SelectedFile } from "../lib/format";

type HomeState = "selecting" | "uploading" | "success";

export function Home(): React.JSX.Element {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [bundleName, setBundleName] = useState("Encrypted share");
  const [expiry, setExpiry] = useState<number | null>(DEFAULT_EXPIRY_SECONDS);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<HomeState>("selecting");
  const [progress, setProgress] = useState<ShareProgress | null>(null);
  const [result, setResult] = useState<CreatedShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  function addFiles(incoming: SelectedFile[]): void {
    const next = mergeSelected(files, incoming);
    setFiles(next);
    if (files.length === 0) {
      setBundleName(bundleNameFromFiles(next));
    }
  }

  async function submit(): Promise<void> {
    setError(null);
    setState("uploading");
    try {
      const created = await createEncryptedShare({
        apiBaseUrl: API_BASE_URL,
        shareBaseUrl: SHARE_BASE_URL,
        name: bundleName.trim() || "Encrypted share",
        files: files.map(({ file, path }) => ({
          path,
          mime: file.type || "application/octet-stream",
          size: file.size,
          stream: () => file.stream(),
        })),
        expiresInSeconds: expiry,
        onProgress: setProgress,
      });
      localStorage.setItem(`share:delete:${created.id}`, created.deleteToken);
      setResult(created);
      setState("success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The share could not be created");
      setState("selecting");
    }
  }

  function reset(): void {
    setFiles([]);
    setBundleName("Encrypted share");
    setProgress(null);
    setResult(null);
    setError(null);
    setState("selecting");
  }

  return (
    <main className="home-shell">
      <section className="hero-copy">
        <p className="eyebrow">Open-source encrypted sharing</p>
        <h1>Share files. Keep the key.</h1>
        <p>End-to-end encrypted sharing for humans and AI agents.</p>
      </section>

      {state === "success" && result ? (
        <SuccessResult result={result} onReset={reset} />
      ) : (
        <section className="upload-panel" aria-label="Create encrypted share">
          {files.length === 0 ? (
            <section
              className={`dropzone ${dragging ? "is-dragging" : ""}`}
              aria-label="Add files or a folder"
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (event.currentTarget === event.target) {
                  setDragging(false);
                }
              }}
              onDrop={async (event) => {
                event.preventDefault();
                setDragging(false);
                addFiles(await selectedFromDrop(event.dataTransfer));
              }}
            >
              <span className="dropzone-icon">
                <Upload size={22} strokeWidth={1.6} />
              </span>
              <strong>Drop files or a folder</strong>
              <span>or browse from your computer</span>
              <div className="dropzone-actions">
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => fileInput.current?.click()}
                >
                  <Plus size={15} /> Browse files
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => folderInput.current?.click()}
                >
                  <FolderOpen size={15} /> Browse folder
                </button>
              </div>
              <small>Markdown, code, images, archives and arbitrary files</small>
            </section>
          ) : (
            <div className="bundle-builder">
              <div className="bundle-heading">
                <div>
                  <input
                    className="bundle-name"
                    value={bundleName}
                    onChange={(event) => setBundleName(event.target.value)}
                    aria-label="Share name"
                    disabled={state === "uploading"}
                  />
                  <p>
                    {files.length} {files.length === 1 ? "file" : "files"} ·{" "}
                    {formatBytes(files.reduce((total, selected) => total + selected.file.size, 0))}
                  </p>
                </div>
                <div className="inline-actions">
                  <button
                    className="button button-quiet"
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={state === "uploading"}
                  >
                    <Plus size={15} /> Add files
                  </button>
                  <button
                    className="button button-quiet"
                    type="button"
                    onClick={() => folderInput.current?.click()}
                    disabled={state === "uploading"}
                  >
                    <FolderOpen size={15} /> Add folder
                  </button>
                </div>
              </div>

              <ul className="file-list" aria-label="Files in this share">
                {files.map((selected) => (
                  <li className="file-row" key={selected.path}>
                    <FileText size={16} strokeWidth={1.6} aria-hidden="true" />
                    <span className="file-path">{selected.path}</span>
                    <span className="file-size">{formatBytes(selected.file.size)}</span>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Remove ${selected.path}`}
                      disabled={state === "uploading"}
                      onClick={() => setFiles(files.filter((file) => file.path !== selected.path))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>

              {state === "uploading" ? (
                <UploadStatus progress={progress} />
              ) : (
                <div className="bundle-footer">
                  <label>
                    <span>Share expiry</span>
                    <select
                      value={expiry ?? "never"}
                      onChange={(event) =>
                        setExpiry(
                          event.target.value === "never" ? null : Number(event.target.value),
                        )
                      }
                    >
                      <option value={3600}>1 hour</option>
                      <option value={86400}>1 day</option>
                      <option value={604800}>7 days</option>
                      <option value={2592000}>30 days</option>
                      <option value="never">Never</option>
                    </select>
                  </label>
                  <div className="submit-area">
                    <button className="button button-primary" type="button" onClick={submit}>
                      Encrypt &amp; share
                    </button>
                    <small>Encryption happens locally before upload.</small>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="trust-row">
            <span>
              <ShieldCheck size={14} /> Encrypted on this device
            </span>
            <span>
              <Check size={14} /> Encryption keys never reach the API
            </span>
          </div>
        </section>
      )}

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
          if (event.target.files) addFiles(selectedFromFileList(event.target.files));
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
          if (event.target.files) addFiles(selectedFromFileList(event.target.files));
          event.target.value = "";
        }}
      />
    </main>
  );
}

function UploadStatus({ progress }: { progress: ShareProgress | null }): React.JSX.Element {
  const stages = [
    "Preparing bundle",
    "Encrypting locally",
    "Uploading ciphertext",
    "Creating share",
  ];
  const activeIndex =
    progress?.stage === "creating"
      ? 0
      : progress?.stage === "encrypting"
        ? 1
        : progress?.stage === "uploading"
          ? 2
          : 3;
  return (
    <div className="upload-status" role="status" aria-live="polite">
      <div className="progress-track">
        <span style={{ width: `${Math.max(8, (activeIndex / 3) * 100)}%` }} />
      </div>
      <ol>
        {stages.map((stage, index) => (
          <li className={index <= activeIndex ? "is-active" : ""} key={stage}>
            <span className="status-marker">
              {index < activeIndex ? "✓" : index === activeIndex ? "●" : "○"}
            </span>
            {stage}
          </li>
        ))}
      </ol>
    </div>
  );
}

function SuccessResult({
  result,
  onReset,
}: {
  result: CreatedShare;
  onReset: () => void;
}): React.JSX.Element {
  return (
    <section className="success-panel" aria-labelledby="success-heading">
      <div className="success-heading">
        <span className="success-mark">
          <Check size={18} />
        </span>
        <div>
          <h2 id="success-heading">Encrypted and ready to share</h2>
          <p>Anyone with the full link can decrypt this bundle.</p>
        </div>
      </div>
      <div className="copy-field primary-copy-field">
        <code>{result.urlWithKey}</code>
        <CopyButton value={result.urlWithKey} />
      </div>
      <p className="security-note">
        The master secret was generated on this device. Only a separate derived access credential
        was sent to the API.
      </p>
      <div className="result-actions">
        <a className="button button-primary" href={result.urlWithKey}>
          Open share
        </a>
        <CopyButton value={result.url} label="Copy link without key" />
        <CopyButton value={result.key} label="Copy key" />
        <button className="button button-quiet" type="button" onClick={onReset}>
          Create another
        </button>
      </div>
      <p className="loss-warning">Save the full link or key. It cannot be recovered.</p>
    </section>
  );
}
