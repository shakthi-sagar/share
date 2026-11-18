import type { UnlockedShare } from "@share/client";
import { displayPath, type ManifestFile } from "@share/protocol";
import { ArrowLeft, ArrowLeftRight, ArrowRight, ImageOff, Images, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatBytes } from "../lib/format";
import { ImageCompare } from "./ImageCompare";
import { previewKind, safeMediaType } from "./kinds";

const PAGE_SIZE = 24;
const THUMB_LIMIT_BYTES = 24 * 1024 * 1024;

/** Page through image collections without fetching the entire encrypted snapshot. */
export function ImageGallery({
  share,
  files,
  onSelect,
}: {
  share: UnlockedShare;
  files: ManifestFile[];
  onSelect: (file: ManifestFile) => void;
}): React.JSX.Element {
  const [page, setPage] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [swapped, setSwapped] = useState(false);
  const pair =
    selection.length === 2 ? selection.map((id) => files.find((file) => file.id === id)) : [];
  const first = swapped ? pair[1] : pair[0];
  const second = swapped ? pair[0] : pair[1];
  const toggle = (file: ManifestFile): void => {
    if (!comparing) {
      onSelect(file);
      return;
    }
    setSelection((current) =>
      current.includes(file.id)
        ? current.filter((id) => id !== file.id)
        : current.length < 2
          ? [...current, file.id]
          : [current[1]!, file.id],
    );
    setSwapped(false);
  };
  const pages = Math.ceil(files.length / PAGE_SIZE);
  const visible = files.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  if (comparing && first && second) {
    return (
      <ImageCompare
        share={share}
        first={first}
        second={second}
        onClose={() => {
          setComparing(false);
          setSelection([]);
          setSwapped(false);
        }}
        onSwap={() => setSwapped((value) => !value)}
      />
    );
  }
  return (
    <section className="gallery-view" aria-label="Image gallery">
      <div className="gallery-heading">
        <div>
          <span className="eyebrow">Snapshot images</span>
          <h1>Gallery</h1>
          <p>Browse images together. Open any image to inspect it at full resolution.</p>
        </div>
        <div className="gallery-toolbar">
          <span className="gallery-count">
            <Images size={16} aria-hidden="true" /> {files.length} images
          </span>
          {files.length > 1 ? (
            <button
              className="button button-secondary"
              type="button"
              aria-pressed={comparing}
              onClick={() => {
                setComparing((value) => !value);
                setSelection([]);
                setSwapped(false);
              }}
            >
              {comparing ? (
                <X size={16} aria-hidden="true" />
              ) : (
                <ArrowLeftRight size={16} aria-hidden="true" />
              )}
              {comparing ? "Cancel compare" : "Compare"}
            </button>
          ) : null}
        </div>
      </div>
      {comparing ? (
        <p className="gallery-selection-note" role="status">
          Select two images to compare them side by side. {selection.length} of 2 selected.
        </p>
      ) : null}
      <div className="gallery-grid">
        {visible.map((file) => (
          <GalleryTile
            key={file.id}
            share={share}
            file={file}
            comparing={comparing}
            selected={selection.includes(file.id)}
            onSelect={() => toggle(file)}
          />
        ))}
      </div>
      {pages > 1 ? (
        <nav className="gallery-pagination" aria-label="Gallery pages">
          <button
            className="button button-secondary"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            type="button"
          >
            <ArrowLeft size={15} /> Previous
          </button>
          <span>
            Page {page + 1} of {pages}
          </span>
          <button
            className="button button-secondary"
            disabled={page + 1 >= pages}
            onClick={() => setPage(page + 1)}
            type="button"
          >
            Next <ArrowRight size={15} />
          </button>
        </nav>
      ) : null}
      <p className="gallery-note">
        Previews decrypt locally as they enter view. The server never sees your images.
      </p>
    </section>
  );
}

function GalleryTile({
  share,
  file,
  onSelect,
  comparing,
  selected,
}: {
  share: UnlockedShare;
  file: ManifestFile;
  onSelect: () => void;
  comparing: boolean;
  selected: boolean;
}): React.JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const name = displayPath(file.path.split("/").at(-1) ?? file.path);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || file.size > THUMB_LIMIT_BYTES) return;
    let disposed = false;
    let objectUrl: string | null = null;
    void new Response(share.openFile(file))
      .blob()
      .then((blob) => {
        if (disposed) return;
        const type = safeMediaType(previewKind(file.path, file.mime), file.path, file.mime);
        objectUrl = URL.createObjectURL(new Blob([blob], { type }));
        setSource(objectUrl);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visible, file, share]);

  return (
    <button
      ref={ref}
      type="button"
      className={`gallery-tile${selected ? " is-comparison-selected" : ""}`}
      aria-pressed={comparing ? selected : undefined}
      onClick={onSelect}
      title={displayPath(file.path)}
    >
      <span className="gallery-tile-image">
        {comparing ? (
          <span className="gallery-select-indicator" aria-hidden="true">
            {selected ? "✓" : "+"}
          </span>
        ) : null}
        {source && !error ? (
          <img src={source} alt="" loading="lazy" onError={() => setError(true)} />
        ) : error || file.size > THUMB_LIMIT_BYTES ? (
          <span className="gallery-placeholder">
            <ImageOff size={22} aria-hidden="true" />{" "}
            {error ? "Preview unavailable" : "Open to view"}
          </span>
        ) : (
          <span className="gallery-placeholder">Decrypting preview…</span>
        )}
      </span>
      <span className="gallery-tile-details">
        <strong>{name}</strong>
        <small>{formatBytes(file.size)}</small>
      </span>
    </button>
  );
}
