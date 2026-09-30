import { useMemo } from "react";
import { useHighlighter } from "./loaders";

/** Highlighting a very large file blocks the page; past this it is shown as plain text. */
const HIGHLIGHT_LIMIT_CHARACTERS = 300_000;

export function CodeView({
  text,
  language,
  label,
}: {
  text: string;
  language: string | undefined;
  label: string;
}): React.JSX.Element {
  const highlightable = language !== undefined && text.length <= HIGHLIGHT_LIMIT_CHARACTERS;
  const hljs = useHighlighter(highlightable);
  const html = useMemo(() => {
    if (!hljs || !language || !hljs.getLanguage(language)) return null;
    return hljs.highlight(text, { language, ignoreIllegals: true }).value;
  }, [hljs, language, text]);
  const gutter = useMemo(() => {
    const lines = text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
    return Array.from({ length: Math.max(lines, 1) }, (_, index) => index + 1).join("\n");
  }, [text]);

  return (
    <div className="code-view" data-scroll-sync="">
      <pre className="code-gutter" aria-hidden="true">
        {gutter}
      </pre>
      <pre className="code-body" title={label}>
        {html === null ? (
          <code>{text}</code>
        ) : (
          <code
            className="hljs"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: highlight.js escapes the source and emits only span elements with class names.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </pre>
    </div>
  );
}
