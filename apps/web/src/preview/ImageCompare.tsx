import type { UnlockedShare } from "@share/client";
import { displayPath, type ManifestFile } from "@share/protocol";
import { ArrowLeftRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatBytes } from "../lib/format";
import { PREVIEW_LIMIT_BYTES, previewKind, safeMediaType } from "./kinds";
import { readShareBlob } from "./share-file-cache";

/** URLs are created from locally decrypted bytes and revoked on unmount. */
function useComparisonImage(
  share: UnlockedShare,
  file: ManifestFile,
): {
  url: string | null;
  error: string | null;
} {
  const [state, setState] = useState<{ url: string | null; error: string | null }>({
    url: null,
    error: null,
  });
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const kind = previewKind(file.path, file.mime);
    if ((kind !== "image" && kind !== "svg") || file.size > PREVIEW_LIMIT_BYTES[kind]) {
      setState({ url: null, error: "This image cannot be previewed at its current size." });
      return;
    }
    setState({ url: null, error: null });
    void readShareBlob(share, file)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(
          new Blob([blob], { type: safeMediaType(kind, file.path, file.mime) }),
        );
        setState({ url: objectUrl, error: null });
      })
      .catch(() => {
        if (!cancelled) setState({ url: null, error: "Unable to decrypt image." });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [share, file]);
  return state;
}

function ComparisonPane({
  share,
  file,
  label,
}: {
  share: UnlockedShare;
  file: ManifestFile;
  label: string;
}): React.JSX.Element {
  const image = useComparisonImage(share, file);
  return (
    <div className="comparison-pane">
      <div className="comparison-pane-heading">
        <span>{label}</span>
        <strong title={displayPath(file.path)}>
          {displayPath(file.path.split("/").at(-1) ?? file.path)}
        </strong>
        <small>{formatBytes(file.size)}</small>
      </div>
      <div className="comparison-image">
        {image.error ? (
          <p role="alert">{image.error}</p>
        ) : image.url ? (
          <img src={image.url} alt={displayPath(file.path)} />
        ) : (
          <p role="status">Decrypting image…</p>
        )}
      </div>
    </div>
  );
}

/** Two side-by-side images share an identical viewport size, making visual review straightforward. */
export function ImageCompare({
  share,
  first,
  second,
  onClose,
  onSwap,
}: {
  share: UnlockedShare;
  first: ManifestFile;
  second: ManifestFile;
  onClose: () => void;
  onSwap: () => void;
}): React.JSX.Element {
  return (
    <section className="image-comparison" aria-label="Compare images">
      <div className="comparison-heading">
        <div>
          <span className="eyebrow">Visual review</span>
          <h1>Compare images</h1>
          <p>Side-by-side inspection. Both images are decrypted only in your browser.</p>
        </div>
        <div className="comparison-actions">
          <button className="button button-secondary" type="button" onClick={onSwap}>
            <ArrowLeftRight size={16} aria-hidden="true" /> Swap
          </button>
          <button className="button button-secondary" type="button" onClick={onClose}>
            <X size={16} aria-hidden="true" /> Back to gallery
          </button>
        </div>
      </div>
      <div className="comparison-grid">
        <ComparisonPane share={share} file={first} label="Image A" />
        <ComparisonPane share={share} file={second} label="Image B" />
      </div>
    </section>
  );
}
