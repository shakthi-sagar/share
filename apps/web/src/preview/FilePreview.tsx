import { AlignLeft, Braces } from "lucide-react";
import { useEffect, useState } from "react";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { formatBytes } from "../lib/format";
import { CodeView } from "./CodeView";
import { CsvView } from "./CsvView";
import { formatSource, formatterFor, MAX_FORMAT_CHARACTERS } from "./format-source";
import { JsonView } from "./JsonView";
import {
  hasRenderedView,
  isTextKind,
  languageFor,
  looksLikeText,
  PREVIEW_LIMIT_BYTES,
  type PreviewKind,
  previewKind,
  SNIFF_LIMIT_BYTES,
  safeMediaType,
} from "./kinds";
import { FontView, HtmlView, ImageView, MediaView, SvgView } from "./MediaViews";
import { OfficeView } from "./OfficeView";
import { PdfView } from "./PdfView";

export type PreviewMode = "rendered" | "source" | "split";

export type LoadedPreview =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "download"; reason: "unsupported" | "too-large" }
  | { status: "ready"; kind: PreviewKind; blob: Blob; text: string | null };

/** Modes a kind offers, in toolbar order. Split needs room, so narrow screens do not offer it. */
export function modesFor(kind: PreviewKind, wide: boolean): PreviewMode[] {
  if (!hasRenderedView(kind)) return [];
  const splittable = kind === "markdown" || kind === "svg" || kind === "html";
  return splittable && wide ? ["rendered", "source", "split"] : ["rendered", "source"];
}

/**
 * Decides whether and how to decrypt a file for preview, then loads it. Files past their kind's
 * limit, and unknown files that are not text, are left for download and never decrypted here.
 */
export function useLoadedPreview(
  file: { path: string; mime: string; size: number },
  load: () => Promise<Blob>,
  describeError: (error: unknown) => string,
): LoadedPreview {
  const [state, setState] = useState<LoadedPreview>({ status: "loading" });
  const { path, mime, size } = file;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `load` and `describeError` are recreated each render; the file identity decides when to reload.
  useEffect(() => {
    let active = true;
    const declared = previewKind(path, mime);
    const sniff = declared === "binary" && size > 0 && size <= SNIFF_LIMIT_BYTES;
    if (declared === "binary" && !sniff) {
      setState({ status: "download", reason: "unsupported" });
      return;
    }
    if (declared !== "binary" && size > PREVIEW_LIMIT_BYTES[declared]) {
      setState({ status: "download", reason: "too-large" });
      return;
    }
    setState({ status: "loading" });
    load()
      .then(async (blob) => {
        let kind = declared;
        if (sniff) {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          if (!looksLikeText(bytes)) {
            if (active) setState({ status: "download", reason: "unsupported" });
            return;
          }
          kind = "text";
        }
        const text = isTextKind(kind) ? await blob.text() : null;
        if (active) setState({ status: "ready", kind, blob, text });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", message: describeError(error) });
      });
    return () => {
      active = false;
    };
  }, [path, mime, size]);

  return state;
}

/** The rendered form of a text kind: Markdown, a table, formatted JSON, an image, or a sandbox. */
export function RenderedText({
  kind,
  text,
  path,
  name,
}: {
  kind: PreviewKind;
  text: string;
  path: string;
  name: string;
}): React.JSX.Element {
  switch (kind) {
    case "markdown":
      return (
        <div className="markdown-scroll" data-scroll-sync="">
          <MarkdownPreview content={text} />
        </div>
      );
    case "csv":
      return <CsvView text={text} path={path} />;
    case "json":
      return <JsonView text={text} path={path} />;
    case "svg":
      return <SvgView text={text} name={name} />;
    case "html":
      return <HtmlView text={text} name={name} />;
    default:
      return <SourceText kind={kind} text={text} path={path} />;
  }
}

export function SourceText({
  kind,
  text,
  path,
}: {
  kind: PreviewKind;
  text: string;
  path: string;
}): React.JSX.Element {
  const language =
    kind === "markdown"
      ? "markdown"
      : kind === "json"
        ? "json"
        : kind === "svg" || kind === "html"
          ? "xml"
          : kind === "csv"
            ? undefined
            : languageFor(path);
  const [formatted, setFormatted] = useState<string | null>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [formatting, setFormatting] = useState(false);
  const [wrap, setWrap] = useState(false);
  const supported = formatterFor(path) !== null && text.length <= MAX_FORMAT_CHARACTERS;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset display-only formatting when source file changes.
  useEffect(() => {
    setFormatted(null);
    setFormatError(null);
  }, [text, path]);
  return (
    <div className={`source-with-toolbar${wrap ? " is-wrapped" : ""}`}>
      <div className="source-toolbar">
        <span>
          {language ?? "Plain text"} ·{" "}
          {formatted !== null ? "Formatted preview" : "Original source"}
        </span>
        <div className="source-actions">
          {supported ? (
            <button
              type="button"
              className="button button-quiet"
              aria-pressed={formatted !== null}
              disabled={formatting}
              onClick={() => {
                if (formatted !== null) {
                  setFormatted(null);
                  setFormatError(null);
                  return;
                }
                setFormatting(true);
                setFormatError(null);
                void formatSource(text, path)
                  .then(setFormatted)
                  .catch((error: unknown) => {
                    setFormatError(
                      error instanceof Error ? error.message : "Unable to format this file.",
                    );
                  })
                  .finally(() => setFormatting(false));
              }}
            >
              <Braces size={14} aria-hidden="true" />{" "}
              {formatting ? "Formatting…" : formatted !== null ? "Original" : "Format"}
            </button>
          ) : null}
          <button
            type="button"
            className="button button-quiet"
            aria-pressed={wrap}
            onClick={() => setWrap((value) => !value)}
          >
            <AlignLeft size={14} aria-hidden="true" /> {wrap ? "No wrap" : "Wrap lines"}
          </button>
        </div>
      </div>
      {formatError ? (
        <p className="source-format-error" role="alert">
          {formatError} Original source is unchanged.
        </p>
      ) : null}
      <CodeView text={formatted ?? text} language={language} label="Source" />
    </div>
  );
}

/** Media kinds shown directly from their decrypted blob. */
export function BlobPreview({
  kind,
  blob,
  path,
  mime,
  name,
}: {
  kind: PreviewKind;
  blob: Blob;
  path: string;
  mime: string;
  name: string;
}): React.JSX.Element | null {
  const type = safeMediaType(kind, path, mime);
  switch (kind) {
    case "image":
      return <ImageView blob={blob} type={type} name={name} />;
    case "pdf":
      return <PdfView blob={blob} name={name} />;
    case "office":
      return <OfficeView blob={blob} path={path} />;
    case "audio":
    case "video":
      return <MediaView blob={blob} type={type} kind={kind} name={name} />;
    case "font":
      return <FontView blob={blob} name={name} />;
    default:
      return null;
  }
}

export function DownloadOnly({
  reason,
  name,
  size,
  action,
}: {
  reason: "unsupported" | "too-large";
  name: string;
  size: number;
  action: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="binary-viewer">
      <h1>{name}</h1>
      <p>{formatBytes(size)}</p>
      <p>
        {reason === "too-large"
          ? "This file is too large to preview here. Download it to open it."
          : "This file type cannot be previewed. Download it to open it on this device."}
      </p>
      {action}
    </div>
  );
}

/** Tracks whether the layout is wide enough for a side-by-side split. */
export function useWideLayout(): boolean {
  const query = "(min-width: 761px)";
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = (): void => setWide(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return wide;
}

const modeLabels: Record<PreviewMode, string> = {
  rendered: "Preview",
  source: "Source",
  split: "Split",
};

export function ModeSwitch({
  modes,
  mode,
  onChange,
  labels = modeLabels,
}: {
  modes: PreviewMode[];
  mode: PreviewMode;
  onChange: (mode: PreviewMode) => void;
  labels?: Record<PreviewMode, string>;
}): React.JSX.Element | null {
  if (modes.length < 2) return null;
  return (
    <fieldset className="mode-switch">
      <legend className="visually-hidden">View</legend>
      {modes.map((candidate) => (
        <button
          key={candidate}
          type="button"
          aria-pressed={mode === candidate}
          onClick={() => onChange(candidate)}
        >
          {labels[candidate]}
        </button>
      ))}
    </fieldset>
  );
}
