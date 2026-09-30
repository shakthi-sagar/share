import { useMemo } from "react";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { CodeView } from "./CodeView";

export function JsonView({ text, path }: { text: string; path: string }): React.JSX.Element {
  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(text) as unknown };
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : "Invalid JSON",
      };
    }
  }, [text]);

  if (!parsed.ok) {
    return (
      <div className="json-view">
        <p className="preview-notice" role="note">
          Not valid JSON ({parsed.message}). Showing the source.
        </p>
        <CodeView text={text} language="json" label="JSON source" />
      </div>
    );
  }
  if (/\.ipynb$/iu.test(path) && isNotebook(parsed.value)) {
    return <NotebookView notebook={parsed.value} />;
  }
  return (
    <CodeView text={JSON.stringify(parsed.value, null, 2)} language="json" label="Formatted JSON" />
  );
}

type NotebookOutput = {
  output_type?: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  ename?: string;
  evalue?: string;
};
type NotebookCell = {
  cell_type?: string;
  source?: string | string[];
  outputs?: NotebookOutput[];
};
type Notebook = { cells: NotebookCell[]; metadata?: { language_info?: { name?: string } } };

function isNotebook(value: unknown): value is Notebook {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { cells?: unknown }).cells)
  );
}

function joined(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join("") : (value ?? "");
}

/**
 * Renders a Jupyter notebook read-only: Markdown cells, code cells, and their text and image
 * outputs. HTML and JavaScript outputs are never rendered; their plain-text form is shown instead.
 */
function NotebookView({ notebook }: { notebook: Notebook }): React.JSX.Element {
  const language = notebook.metadata?.language_info?.name ?? "python";
  return (
    <div className="notebook-view" data-scroll-sync="">
      {notebook.cells.map((cell, index) => {
        const source = joined(cell.source);
        const key = `${index}-${cell.cell_type}`;
        if (cell.cell_type === "markdown") {
          return (
            <section className="notebook-cell is-markdown" key={key}>
              <MarkdownPreview content={source} />
            </section>
          );
        }
        return (
          <section className="notebook-cell" key={key}>
            <CodeView
              text={source}
              language={cell.cell_type === "code" ? language : undefined}
              label={`Cell ${index + 1}`}
            />
            {(cell.outputs ?? []).map((output, outputIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: outputs are static and never reorder.
              <NotebookOutputView output={output} key={outputIndex} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function NotebookOutputView({ output }: { output: NotebookOutput }): React.JSX.Element | null {
  const image = output.data?.["image/png"] ?? output.data?.["image/jpeg"];
  if (image) {
    const type = output.data?.["image/png"] ? "image/png" : "image/jpeg";
    return (
      <img
        className="notebook-image"
        src={`data:${type};base64,${joined(image).replace(/\s/gu, "")}`}
        alt="Cell output"
      />
    );
  }
  const text =
    output.output_type === "error"
      ? `${output.ename ?? "Error"}: ${output.evalue ?? ""}`
      : joined(output.text ?? output.data?.["text/plain"]);
  if (!text) return null;
  return (
    <pre className={`notebook-output${output.output_type === "error" ? " is-error" : ""}`}>
      {text}
    </pre>
  );
}
