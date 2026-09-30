import {
  assertShareWithinLimits,
  type CreatedShare,
  createEncryptedShare,
  measureShare,
  type ShareProgress,
} from "@share/client";
import { AlertTriangle, Check, ChevronRight, File, LockKeyhole, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  API_BASE_URL,
  DEFAULT_EXPIRY_SECONDS,
  MAX_SHARE_BYTES,
  SHARE_BASE_URL,
} from "../lib/config";
import { describeShareError } from "../lib/errors";
import { formatBytes } from "../lib/format";
import { rememberPublishedShare } from "../lib/published-shares";
import { workspaceFiles } from "../workspace/model";
import type { Workspace } from "../workspace/types";
import { CopyButton } from "./CopyButton";

type PublishState = "ready" | "uploading" | "success";
type WorkspaceFiles = ReturnType<typeof workspaceFiles>;

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
  const totalSize = files.reduce((total, { entry }) => total + entry.blob.size, 0);
  // Checked before publishing so an oversized or unpublishable snapshot never starts an upload.
  const blocker = useMemo(() => {
    try {
      const sources = workspaceFiles(workspace).map(({ entry, path }) => ({
        path,
        mime: entry.mimeType,
        size: entry.blob.size,
      }));
      assertShareWithinLimits(measureShare(workspace.name, sources), MAX_SHARE_BYTES);
      return null;
    } catch (caught) {
      return describeShareError(caught, "This snapshot cannot be published");
    }
  }, [workspace]);

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
        maxShareBytes: MAX_SHARE_BYTES,
        onProgress: setProgress,
      });
      rememberPublishedShare({
        id: created.id,
        deleteToken: created.deleteToken,
        expiresAt: created.expiresAt,
        name: workspace.name,
        fileCount: files.length,
      });
      setResult(created);
      setState("success");
    } catch (caught) {
      setError(describeShareError(caught, "The snapshot could not be published"));
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
              {state === "success" ? "Snapshot published" : "Review and publish"}
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
            <div className="snapshot-identity">
              <span className="snapshot-icon" aria-hidden="true">
                <LockKeyhole size={18} />
              </span>
              <div>
                <strong>{workspace.name}</strong>
                <span>Immutable copy of the current local draft</span>
              </div>
            </div>

            <dl className="publish-summary">
              <div>
                <dt>Files</dt>
                <dd>{files.length}</dd>
              </div>
              <div>
                <dt>Total size</dt>
                <dd>
                  {formatBytes(totalSize)}
                  <small> of {formatBytes(MAX_SHARE_BYTES)} max</small>
                </dd>
              </div>
              <div>
                <dt>Encryption</dt>
                <dd>AES-256-GCM</dd>
              </div>
            </dl>

            <details className="snapshot-files">
              <summary>
                <span>Review files</span>
                <ChevronRight size={14} aria-hidden="true" />
              </summary>
              <ul>
                {files.map(({ entry, path }) => (
                  <li key={entry.id}>
                    <File size={13} aria-hidden="true" />
                    <code title={path}>{path}</code>
                    <span>{formatBytes(entry.blob.size)}</span>
                  </li>
                ))}
              </ul>
            </details>

            <label className="field-label">
              <span>Link expires</span>
              <select
                value={expiry ?? "never"}
                disabled={state === "uploading"}
                onChange={(event) =>
                  setExpiry(event.target.value === "never" ? null : Number(event.target.value))
                }
              >
                <option value={3600}>In 1 hour</option>
                <option value={86400}>In 1 day</option>
                <option value={259200}>In 3 days</option>
                <option value={604800}>In 7 days</option>
                <option value="never">Never</option>
              </select>
            </label>

            {state === "uploading" ? <UploadStatus progress={progress} files={files} /> : null}
            {blocker ? (
              <p className="inline-error" role="alert">
                {blocker}
              </p>
            ) : null}
            {error ? (
              <p className="inline-error" role="alert">
                {error} Your local workspace is unchanged.
              </p>
            ) : null}
            <div className="dialog-actions publish-actions">
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
                disabled={files.length === 0 || blocker !== null || state === "uploading"}
                onClick={() => void publish()}
              >
                {state === "uploading" ? "Publishing…" : "Encrypt and publish"}
              </button>
            </div>
            <p className="dialog-note publish-note">
              The master secret stays in the URL fragment and is never sent to the API.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function UploadStatus({
  progress,
  files,
}: {
  progress: ShareProgress | null;
  files: WorkspaceFiles;
}): React.JSX.Element {
  const stages = ["Preparing", "Encrypting", "Uploading", "Finalizing"];
  const activeIndex =
    progress?.stage === "creating"
      ? 0
      : progress?.stage === "encrypting"
        ? 1
        : progress?.stage === "uploading"
          ? 2
          : 3;
  const currentPath =
    progress?.stage === "encrypting" || progress?.stage === "uploading" ? progress.path : null;
  const fileIndex = currentPath ? files.findIndex(({ path }) => path === currentPath) : -1;
  const fileFraction =
    progress?.stage === "encrypting"
      ? progress.totalBytes === 0
        ? 1
        : progress.processedBytes / progress.totalBytes
      : progress?.stage === "uploading"
        ? progress.totalChunks === 0
          ? 1
          : progress.uploadedChunks / progress.totalChunks
        : progress?.stage === "finalizing" || progress?.stage === "complete"
          ? 1
          : 0;
  const overallProgress =
    files.length > 0 && fileIndex >= 0
      ? ((fileIndex + fileFraction) / files.length) * 100
      : activeIndex === 3
        ? 96
        : 4;
  const detail = progressDetail(progress);

  return (
    <div className="upload-status" role="status" aria-live="polite">
      <div className="upload-status-heading">
        <strong>{detail.label}</strong>
        <span>{Math.round(overallProgress)}%</span>
      </div>
      {detail.detail ? <code title={detail.detail}>{detail.detail}</code> : null}
      <div className="progress-track">
        <span style={{ width: `${Math.max(4, overallProgress)}%` }} />
      </div>
      <ol>
        {stages.map((stage, index) => (
          <li className={index <= activeIndex ? "is-active" : ""} key={stage}>
            <span className="status-marker" aria-hidden="true">
              {index < activeIndex ? "✓" : index === activeIndex ? "●" : "○"}
            </span>
            {stage}
          </li>
        ))}
      </ol>
    </div>
  );
}

function progressDetail(progress: ShareProgress | null): { label: string; detail?: string } {
  if (!progress || progress.stage === "creating") return { label: "Preparing encrypted upload" };
  if (progress.stage === "encrypting") {
    return {
      label: `Encrypting ${formatBytes(progress.processedBytes)} of ${formatBytes(progress.totalBytes)}`,
      detail: progress.path,
    };
  }
  if (progress.stage === "uploading") {
    return {
      label: `Uploading chunk ${Math.min(progress.uploadedChunks + 1, progress.totalChunks)} of ${progress.totalChunks}`,
      detail: progress.path,
    };
  }
  if (progress.stage === "finalizing") return { label: "Finalizing snapshot" };
  return { label: "Snapshot published" };
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
          <p>
            {result.expiresAt
              ? `This link expires ${formatExpiry(result.expiresAt)}.`
              : "This link does not expire automatically."}
          </p>
        </div>
      </div>

      <div className="copy-field primary-copy-field">
        <code title={result.urlWithKey}>{result.urlWithKey}</code>
        <CopyButton value={result.urlWithKey} label="Copy full link" intent="primary" />
      </div>
      <p className="share-secret-note">
        <AlertTriangle size={14} aria-hidden="true" />
        <span>
          Anyone with the full link can decrypt the snapshot, so send it through a trusted channel.
          Copy it now: the key is not stored anywhere and cannot be recovered.
        </span>
      </p>

      <div className="result-actions result-primary-actions">
        <a
          className="button button-secondary"
          href={result.urlWithKey}
          target="_blank"
          rel="noreferrer"
        >
          Open share
        </a>
        <button className="button button-quiet" type="button" onClick={onClose}>
          Continue editing
        </button>
      </div>

      <details className="advanced-share">
        <summary>Send the link and key separately</summary>
        <p>Use two different trusted channels for additional separation.</p>
        <div className="copy-field">
          <code title={result.url}>{result.url}</code>
          <CopyButton value={result.url} label="Copy link" />
        </div>
        <div className="copy-field">
          <code title={result.key}>{result.key}</code>
          <CopyButton value={result.key} label="Copy key" />
        </div>
      </details>

      <p className="publish-revoke-note">
        Published shares are listed on the home page, where you can revoke this snapshot before it
        expires.
      </p>
    </div>
  );
}

function formatExpiry(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
