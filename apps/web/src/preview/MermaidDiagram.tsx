import { useEffect, useState } from "react";
import { loadMermaid } from "./loaders";

let diagramCount = 0;

type DiagramState =
  | { kind: "rendering" }
  | { kind: "ready"; url: string; width: number | null }
  | { kind: "error"; message: string };

/**
 * Renders a Mermaid block to SVG and shows it as an image. An image cannot run script or reach the
 * page, so a diagram from someone else's share stays inert. Re-rendering waits for typing to pause.
 */
export function MermaidDiagram({ source }: { source: string }): React.JSX.Element {
  const [state, setState] = useState<DiagramState>({ kind: "rendering" });
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    const timer = window.setTimeout(() => {
      diagramCount += 1;
      const id = `mermaid-diagram-${diagramCount}`;
      loadMermaid()
        .then((mermaid) => mermaid.render(id, source))
        .then(({ svg }) => {
          if (!active) return;
          url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
          setState({ kind: "ready", url, width: intrinsicWidth(svg) });
        })
        .catch((error: unknown) => {
          if (!active) return;
          const message = error instanceof Error ? error.message : "The diagram could not be drawn";
          setState({ kind: "error", message: message.split("\n")[0] ?? message });
        })
        .finally(() => {
          // Mermaid leaves its measuring element behind when a render fails.
          document.getElementById(`d${id}`)?.remove();
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [source]);

  return (
    <figure className="mermaid-diagram">
      {state.kind === "ready" ? (
        <img
          src={state.url}
          alt="Mermaid diagram"
          style={state.width ? { width: `min(100%, ${state.width}px)` } : undefined}
        />
      ) : state.kind === "rendering" ? (
        <div className="mermaid-state" role="status">
          Drawing diagram…
        </div>
      ) : (
        <div className="mermaid-state is-error" role="alert">
          Diagram error: {state.message}
        </div>
      )}
      <figcaption>
        <button
          className="mermaid-source-toggle"
          type="button"
          aria-expanded={showSource}
          onClick={() => setShowSource((value) => !value)}
        >
          {showSource ? "Hide source" : "Show source"}
        </button>
      </figcaption>
      {showSource || state.kind === "error" ? (
        <pre className="mermaid-source">
          <code>{source}</code>
        </pre>
      ) : null}
    </figure>
  );
}

function intrinsicWidth(svg: string): number | null {
  const match =
    /max-width:\s*([\d.]+)px/u.exec(svg) ?? /viewBox="[\d.-]+ [\d.-]+ ([\d.]+)/u.exec(svg);
  const width = match?.[1] ? Number(match[1]) : Number.NaN;
  return Number.isFinite(width) && width > 0 ? width : null;
}
