import { type CreatedShare, createEncryptedShare, type ShareProgress } from "@share/client";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE_URL, DEFAULT_EXPIRY_SECONDS, SHARE_BASE_URL } from "../lib/config";
import { formatBytes } from "../lib/format";
import { workspaceFiles } from "../workspace/model";
import type { Workspace } from "../workspace/types";
import { CopyButton } from "./CopyButton";

type PublishState = "ready" | "uploading" | "success";

export function SharePublisher({
  workspace,
  onClose,
}: {
  workspace: Workspace;
  onClose: () => void;
}): React.JSX.Element {
  const files = workspaceFiles(workspace);
  const [expiry, setExpiry] = useState<number | null>(DEFAULT_EXPIRY_SECONDS);
  const [state, setState] = useState<PublishState>("ready");
  const [progress, setProgress] = useState<ShareProgress | null>(null);
  const [result, setResult] = useState<CreatedShare | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && state !== "uploading") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, state]);

  async function publish(): Promise<void> {
    setError(null);
    setState("uploading");
    try {
      const created = await createEncryptedShare({
        apiBaseUrl: API_BASE_URL,
        shareBaseUrl: SHARE_BASE_URL,
        name: workspace.name,
        files: files.map(({ entry, path }) => ({
          path,
          mime: entry.mimeType,
          size: entry.blob.size,
          stream: () => entry.blob.stream(),
        })),
        expiresInSeconds: expiry,
        onProgress: setProgress,
      });
      localStorage.setItem(`share:delete:${created.id}`, created.deleteToken);
      setResult(created);
      setState("success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The share could not be created");
      setState("ready");
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="publish-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-heading"
      >
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Encrypted snapshot</p>
            <h2 id="publish-heading">
              {state === "success" ? "Share created" : `Share “${workspace.name}”`}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close share dialog"
            disabled={state === "uploading"}
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>

        {state === "success" && result ? (
          <PublishSuccess result={result} onClose={onClose} />
        ) : (
          <>
            <p className="dialog-copy">
              This publishes an immutable encrypted snapshot. Your local workspace stays editable.
            </p>
            <dl className="publish-summary">
              <div>
                <dt>Files</dt>
                <dd>{files.length}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>
                  {formatBytes(files.reduce((total, { entry }) => total + entry.blob.size, 0))}
                </dd>
              </div>
            </dl>
            <label className="field-label">
              <span>Expiry</span>
              <select
                value={expiry ?? "never"}
                disabled={state === "uploading"}
                onChange={(event) =>
                  setExpiry(event.target.value === "never" ? null : Number(event.target.value))
                }
              >
                <option value={3600}>1 hour</option>
                <option value={86400}>1 day</option>
                <option value={604800}>7 days</option>
                <option value={2592000}>30 days</option>
                <option value="never">Never</option>
              </select>
            </label>

            {state === "uploading" ? <UploadStatus progress={progress} /> : null}
            {error ? (
              <p className="inline-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="dialog-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={state === "uploading"}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                type="button"
                disabled={files.length === 0 || state === "uploading"}
                onClick={() => void publish()}
              >
                {state === "uploading" ? "Encrypting and uploading…" : "Encrypt & share"}
              </button>
            </div>
            {files.length === 0 ? (
              <p className="dialog-note">Add at least one file before sharing.</p>
            ) : (
              <p className="dialog-note">Encryption happens locally before upload.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function UploadStatus({ progress }: { progress: ShareProgress | null }): React.JSX.Element {
  const stages = ["Preparing", "Encrypting", "Uploading", "Finalizing"];
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

function PublishSuccess({
  result,
  onClose,
}: {
  result: CreatedShare;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div className="publish-success">
      <div className="success-heading">
        <span className="success-mark">
          <Check size={18} />
        </span>
        <div>
          <h3>Encrypted and ready</h3>
          <p>Anyone with the full link can decrypt this snapshot.</p>
        </div>
      </div>
      <div className="copy-field primary-copy-field">
        <code>{result.urlWithKey}</code>
        <CopyButton value={result.urlWithKey} />
      </div>
      <div className="result-actions">
        <a
          className="button button-primary"
          href={result.urlWithKey}
          target="_blank"
          rel="noreferrer"
        >
          Open share
        </a>
        <CopyButton value={result.url} label="Copy link without key" />
        <CopyButton value={result.key} label="Copy key" />
        <button className="button button-quiet" type="button" onClick={onClose}>
          Continue editing
        </button>
      </div>
      <p className="loss-warning">Save the full link or key. It cannot be recovered.</p>
    </div>
  );
}
