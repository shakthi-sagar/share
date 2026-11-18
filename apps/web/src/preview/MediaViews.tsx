import { Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { type HtmlAssetContext, resolveHtmlAssets } from "./html-assets";

/** A blob URL for `blob` with an explicit type, revoked when the view goes away. */
export function useObjectUrl(blob: Blob, type: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const typed = blob.type === type ? blob : new Blob([blob], { type });
    const next = URL.createObjectURL(typed);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob, type]);
  return url;
}

/** Image viewer with an accessible fullscreen lightbox, bounded zoom, and pointer panning. */
export function ImageView({
  blob,
  type,
  name,
  checkerboard = false,
}: {
  blob: Blob;
  type: string;
  name: string;
  checkerboard?: boolean;
}): React.JSX.Element {
  const url = useObjectUrl(blob, type);
  const [expanded, setExpanded] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState<string | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const zoom = useCallback(
    (delta: number): void =>
      setScale((current) => Math.min(8, Math.max(1, Math.round((current + delta) * 10) / 10))),
    [],
  );
  const reset = useCallback((): void => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);
  const close = useCallback((): void => {
    setExpanded(false);
    reset();
  }, [reset]);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const keydown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
      if (event.key === "+" || event.key === "=") zoom(0.25);
      if (event.key === "-") zoom(-0.25);
      if (event.key === "0") reset();
      if (event.key === "Tab") {
        const controls = [
          ...document.querySelectorAll<HTMLElement>(".image-lightbox button:not(:disabled)"),
        ];
        const index = controls.indexOf(document.activeElement as HTMLElement);
        if (
          controls.length &&
          ((event.shiftKey && index === 0) || (!event.shiftKey && index === controls.length - 1))
        ) {
          event.preventDefault();
          controls[event.shiftKey ? controls.length - 1 : 0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keydown);
      opener.current?.focus();
    };
  }, [expanded, close, zoom, reset]);

  if (!url) return <div className="content-state">Preparing image…</div>;
  return (
    <div className={`image-viewer${checkerboard ? " is-checkerboard" : ""}`} data-scroll-sync="">
      <button
        ref={opener}
        className="image-zoom"
        type="button"
        aria-label={`Open ${name} fullscreen`}
        onClick={() => setExpanded(true)}
      >
        <img
          src={url}
          alt={name}
          onLoad={(event) =>
            setDimensions(
              `${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`,
            )
          }
        />
      </button>
      <button
        className="button button-secondary image-expand-button"
        type="button"
        onClick={() => setExpanded(true)}
      >
        <Maximize2 size={15} aria-hidden="true" /> Fullscreen
      </button>
      {dimensions ? <p className="image-dimensions">{dimensions} px</p> : null}
      {expanded ? (
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Fullscreen preview: ${name}`}
        >
          <div className="image-lightbox-toolbar">
            <span title={name}>
              {name} {dimensions ? `· ${dimensions} px` : ""}
            </span>
            <div>
              <button
                type="button"
                className="icon-button"
                aria-label="Zoom out"
                disabled={scale <= 1}
                onClick={() => zoom(-0.25)}
              >
                <Minus size={18} />
              </button>
              <span aria-live="polite">{Math.round(scale * 100)}%</span>
              <button
                type="button"
                className="icon-button"
                aria-label="Zoom in"
                disabled={scale >= 8}
                onClick={() => zoom(0.25)}
              >
                <Plus size={18} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Reset zoom and pan"
                onClick={reset}
              >
                <RotateCcw size={17} />
              </button>
              <button
                ref={closeButton}
                type="button"
                className="icon-button"
                aria-label="Close fullscreen preview"
                onClick={close}
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div
            className="image-lightbox-stage"
            onWheel={(event) => {
              if (event.ctrlKey) {
                event.preventDefault();
                zoom(event.deltaY < 0 ? 0.25 : -0.25);
              }
            }}
            onPointerDown={(event) => {
              if (scale > 1) {
                pointer.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
                event.currentTarget.setPointerCapture(event.pointerId);
              }
            }}
            onPointerMove={(event) => {
              if (pointer.current)
                setOffset({
                  x: event.clientX - pointer.current.x,
                  y: event.clientY - pointer.current.y,
                });
            }}
            onPointerUp={() => {
              pointer.current = null;
            }}
            onPointerCancel={() => {
              pointer.current = null;
            }}
          >
            <img
              src={url}
              alt={name}
              draggable={false}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                cursor: scale > 1 ? "grab" : "default",
              }}
            />
          </div>
          <p className="image-lightbox-hint">
            Use + / − to zoom, drag to pan, 0 to reset, Esc to close.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** SVG text shown as an image, which renders it without running any script it contains. */
export function SvgView({ text, name }: { text: string; name: string }): React.JSX.Element {
  const blob = useMemo(() => new Blob([text], { type: "image/svg+xml" }), [text]);
  return <ImageView blob={blob} type="image/svg+xml" name={name} checkerboard />;
}

/**
 * Renders HTML in an iframe sandboxed with no permissions: no scripts, forms, popups, or access to
 * this page, and the page's Content Security Policy still blocks every remote load.
 */
export function HtmlView({
  text,
  name,
  assets,
}: {
  text: string;
  name: string;
  assets?: HtmlAssetContext | undefined;
}): React.JSX.Element {
  const [rendered, setRendered] = useState(text);
  const [loading, setLoading] = useState(Boolean(assets));
  const [stats, setStats] = useState<{ loaded: number; skipped: number } | null>(null);
  const { path, files, openFile } = assets ?? {};
  // biome-ignore lint/correctness/useExhaustiveDependencies: openFile can be regenerated by the parent; stable share identity and path define asset resolution.
  useEffect(() => {
    if (!path || !files || !openFile) {
      setRendered(text);
      setLoading(false);
      setStats(null);
      return;
    }
    let cancelled = false;
    let urls: string[] = [];
    setLoading(true);
    void resolveHtmlAssets(text, { path, files, openFile })
      .then((result) => {
        if (cancelled) {
          for (const url of result.urls) URL.revokeObjectURL(url);
          return;
        }
        urls = result.urls;
        setRendered(result.html);
        setStats({ loaded: result.loaded, skipped: result.skipped });
      })
      .catch(() => {
        if (!cancelled) setStats({ loaded: 0, skipped: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [text, path, files]);
  return (
    <div className="html-view">
      <p className="preview-notice" role="note">
        {loading
          ? "Resolving encrypted local assets…"
          : `Sandboxed preview. Scripts and remote content are disabled.${stats ? ` ${stats.loaded} local assets resolved${stats.skipped ? `; ${stats.skipped} unavailable.` : "."}` : ""}`}
      </p>
      {loading ? (
        <div className="content-state" role="status">
          Preparing HTML preview…
        </div>
      ) : (
        <iframe
          title={`Rendered ${name}`}
          sandbox={assets ? "allow-same-origin" : ""}
          onLoad={(event) => {
            if (!assets?.onOpenFile) return;
            const doc = event.currentTarget.contentDocument;
            doc?.addEventListener("click", (clicked) => {
              const element = clicked.target as Element | null;
              const link = element?.closest?.("a[data-share-path]");
              const path = link?.getAttribute("data-share-path");
              if (!path) return;
              clicked.preventDefault();
              const file = assets.files.find((item) => item.path === path);
              if (file) assets.onOpenFile?.(file);
            });
          }}
          srcDoc={rendered}
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}

export function MediaView({
  blob,
  type,
  kind,
  name,
}: {
  blob: Blob;
  type: string;
  kind: "audio" | "video";
  name: string;
}): React.JSX.Element {
  const url = useObjectUrl(blob, type);
  if (!url) return <div className="content-state">Preparing media…</div>;
  return <MediaPlayer key={url} url={url} kind={kind} name={name} />;
}

export function MediaPlayer({
  url,
  kind,
  name,
}: {
  url: string;
  kind: "audio" | "video";
  name: string;
}): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="content-state">
        This browser cannot play this format. Download it instead.
      </div>
    );
  }
  return (
    <div className={`media-view is-${kind}`}>
      {kind === "video" ? (
        // biome-ignore lint/a11y/useMediaCaption: shared files carry no caption track to offer.
        <video
          src={url}
          controls
          preload="metadata"
          aria-label={name}
          onError={() => setFailed(true)}
        />
      ) : (
        // biome-ignore lint/a11y/useMediaCaption: shared files carry no caption track to offer.
        <audio
          src={url}
          controls
          preload="metadata"
          aria-label={name}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

const fontSizes = [48, 32, 20, 14];

/** Loads a font from its bytes, without a network request, and shows it at several sizes. */
export function FontView({ blob, name }: { blob: Blob; name: string }): React.JSX.Element {
  const family = `shared-font-${useId().replace(/[^a-z0-9]/giu, "")}`;
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [sample, setSample] = useState("The quick brown fox jumps over the lazy dog 0123456789");

  useEffect(() => {
    let face: FontFace | null = null;
    let active = true;
    void blob
      .arrayBuffer()
      .then((buffer) => new FontFace(family, buffer).load())
      .then((loaded) => {
        if (!active) return;
        face = loaded;
        document.fonts.add(loaded);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
      if (face) document.fonts.delete(face);
    };
  }, [blob, family]);

  if (state === "error") {
    return <div className="content-state">This font could not be loaded for preview.</div>;
  }
  return (
    <div className="font-view" data-scroll-sync="">
      <label className="field-label">
        <span>Sample text</span>
        <input value={sample} onChange={(event) => setSample(event.target.value)} />
      </label>
      {state === "loading" ? (
        <p className="content-state">Loading {name}…</p>
      ) : (
        fontSizes.map((size) => (
          <p className="font-sample" key={size} style={{ fontFamily: family, fontSize: size }}>
            <span className="font-sample-size">{size}px</span>
            {sample}
          </p>
        ))
      )}
      {state === "ready" ? (
        <p className="font-sample font-glyphs" style={{ fontFamily: family }}>
          ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz !@#$%&amp;*()[]{}
        </p>
      ) : null}
    </div>
  );
}
