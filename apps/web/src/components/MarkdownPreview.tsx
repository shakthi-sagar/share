import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeView } from "../preview/CodeView";
import { MermaidDiagram } from "../preview/MermaidDiagram";

/** Common fence names that highlight.js knows under another name. */
const fenceAliases: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  py: "python",
  rb: "ruby",
  rs: "rust",
  md: "markdown",
  html: "xml",
  svg: "xml",
  jsonc: "json",
};

const components: Components = {
  img: ({ alt }) => (
    <span className="blocked-remote-image">Image blocked: {alt || "remote image"}</span>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  pre: ({ node, children }) => {
    const block = fencedBlock(node);
    if (!block) return <pre>{children}</pre>;
    if (block.language === "mermaid") return <MermaidDiagram source={block.text} />;
    return (
      <div className="markdown-code">
        <CodeView
          text={block.text.replace(/\n$/u, "")}
          language={block.language ? (fenceAliases[block.language] ?? block.language) : undefined}
          label={block.language ? `${block.language} code` : "Code"}
        />
      </div>
    );
  },
};

/**
 * Renders Markdown without raw HTML. Remote images are blocked, links open in a new tab without a
 * referrer, fenced code is highlighted, and `mermaid` fences become diagrams.
 */
export function MarkdownPreview({ content }: { content: string }): React.JSX.Element {
  return (
    <article className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </article>
  );
}

type HastNode = { type?: string; tagName?: string; value?: string; children?: HastNode[] } & {
  properties?: { className?: unknown };
};

/** Reads the language and text of a `<pre><code class="language-x">` block from its syntax tree. */
function fencedBlock(node: unknown): { language: string | undefined; text: string } | null {
  const code = (node as HastNode | undefined)?.children?.find(
    (child) => child.type === "element" && child.tagName === "code",
  );
  if (!code) return null;
  const classes = Array.isArray(code.properties?.className) ? code.properties.className : [];
  const languageClass = classes.find(
    (value): value is string => typeof value === "string" && value.startsWith("language-"),
  );
  return {
    language: languageClass?.slice("language-".length).toLowerCase(),
    text: textOf(code),
  };
}

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}
