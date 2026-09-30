import { useEffect, useId, useMemo, useState } from "react";

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

/** Fits the image to the pane; clicking toggles its actual size. */
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
  const [actualSize, setActualSize] = useState(false);
  const [dimensions, setDimensions] = useState<string | null>(null);
  if (!url) return <div className="content-state">Preparing image…</div>;
  return (
    <div
      className={`image-viewer${checkerboard ? " is-checkerboard" : ""}${actualSize ? " is-actual-size" : ""}`}
      data-scroll-sync=""
    >
      <button
        className="image-zoom"
        type="button"
        aria-pressed={actualSize}
        aria-label={actualSize ? "Fit image to view" : "Show image at actual size"}
        onClick={() => setActualSize((value) => !value)}
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
      {dimensions ? <p className="image-dimensions">{dimensions} px</p> : null}
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
export function HtmlView({ text, name }: { text: string; name: string }): React.JSX.Element {
  return (
    <div className="html-view">
      <p className="preview-notice" role="note">
        Scripts, forms, and remote content are disabled in this preview.
      </p>
      <iframe title={`Rendered ${name}`} sandbox="" srcDoc={text} referrerPolicy="no-referrer" />
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
  const [failed, setFailed] = useState(false);
  if (!url) return <div className="content-state">Preparing media…</div>;
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
