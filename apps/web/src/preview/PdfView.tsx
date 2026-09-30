import { Minus, Plus } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

type PdfJs = typeof import("pdfjs-dist");
let pdfjs: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]).then(
    ([module, worker]) => {
      module.GlobalWorkerOptions.workerSrc = worker.default;
      return module;
    },
    (error: unknown) => {
      pdfjs = null;
      throw error;
    },
  );
  return pdfjs;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/**
 * Renders a PDF with pdf.js onto canvases, one page at a time as it scrolls into view. PDF
 * scripts, forms, and links are not executed or followed; only page drawings are shown.
 */
export function PdfView({ blob, name }: { blob: Blob; name: string }): React.JSX.Element {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let active = true;
    let task: { destroy(): Promise<void> } | null = null;
    Promise.all([loadPdfJs(), blob.arrayBuffer()])
      .then(([module, data]) => {
        const loading = module.getDocument({
          data: new Uint8Array(data),
          // WebAssembly decoders would need 'wasm-unsafe-eval' in the page policy.
          useWasm: false,
          enableXfa: false,
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
        });
        task = loading;
        if (!active) void loading.destroy();
        return loading.promise;
      })
      .then((pdf) => {
        if (active) setDocument(pdf);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        const password = caught instanceof Error && caught.name === "PasswordException";
        setError(
          password
            ? "This PDF is password protected. Download it to open it."
            : "This PDF could not be rendered. Download it to open it.",
        );
      });
    return () => {
      active = false;
      void task?.destroy();
    };
  }, [blob]);

  if (error) return <div className="content-state error-state">{error}</div>;
  if (!document) {
    return (
      <div className="content-state" role="status">
        Rendering {name}…
      </div>
    );
  }

  const zoomIndex = ZOOM_STEPS.indexOf(zoom);
  return (
    <div className="pdf-view" data-scroll-sync="">
      <div className="pdf-toolbar">
        <span>
          {document.numPages} {document.numPages === 1 ? "page" : "pages"}
        </span>
        <div className="pdf-zoom">
          <button
            className="icon-button"
            type="button"
            aria-label="Zoom out"
            disabled={zoomIndex <= 0}
            onClick={() => setZoom(ZOOM_STEPS[zoomIndex - 1] ?? zoom)}
          >
            <Minus size={15} />
          </button>
          <span aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button
            className="icon-button"
            type="button"
            aria-label="Zoom in"
            disabled={zoomIndex >= ZOOM_STEPS.length - 1}
            onClick={() => setZoom(ZOOM_STEPS[zoomIndex + 1] ?? zoom)}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>
      <div className="pdf-pages">
        {pageNumbers(document.numPages).map((pageNumber) => (
          <PdfPage key={pageNumber} document={document} pageNumber={pageNumber} zoom={zoom} />
        ))}
      </div>
    </div>
  );
}

function PdfPage({
  document,
  pageNumber,
  zoom,
}: {
  document: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
}): React.JSX.Element {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  const [aspect, setAspect] = useState(1.294);

  useEffect(() => {
    const element = holder.current;
    if (!element || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: zoom changes the holder width, so the page must be drawn again at the new size.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: { cancel(): void; promise: Promise<void> } | null = null;
    void document.getPage(pageNumber).then((page) => {
      const target = canvas.current;
      const width = holder.current?.clientWidth ?? 800;
      if (cancelled || !target) return;
      const base = page.getViewport({ scale: 1 });
      setAspect(base.height / base.width);
      const scale = (width / base.width) * (window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale });
      target.width = Math.floor(viewport.width);
      target.height = Math.floor(viewport.height);
      task = page.render({ canvas: target, viewport });
      task.promise.catch(() => {
        // A cancelled render rejects; the next effect run draws the page again.
      });
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [document, pageNumber, visible, zoom]);

  return (
    <div
      ref={holder}
      className="pdf-page"
      style={{ width: `${zoom * 100}%`, aspectRatio: `1 / ${aspect}` }}
    >
      <canvas ref={canvas} aria-label={`Page ${pageNumber}`} role="img" />
    </div>
  );
}

function pageNumbers(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}
