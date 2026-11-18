import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Search, X } from "lucide-react";
import { isValidElement, type ReactNode, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppLink } from "../components/AppLink";
import { CopyButton } from "../components/CopyButton";
import { GithubMark } from "../components/GithubMark";
import { type DocsPage, docsHref, docsPages, findDocsPage } from "../lib/docs";
import { repositoryUrl } from "../lib/links";
import { isInternalHref } from "../lib/navigation";

export function Docs({ slug }: { slug: string }): React.JSX.Element {
  const page = findDocsPage(slug);
  const [query, setQuery] = useState("");
  const searchField = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
    if (!words.length) return [];
    return docsPages.filter((item) => {
      const haystack = `${item.title} ${item.summary} ${item.content}`.toLocaleLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }, [query]);
  const headings = useMemo(
    () =>
      page?.content
        .split("\n")
        .filter((line) => /^#{2,3} /u.test(line))
        .map((line) => {
          const depth = line.match(/^#+/u)?.[0].length ?? 2;
          const title = line.replace(/^#+\s+/u, "").replace(/[`*_]/gu, "");
          return { depth, title, anchor: headingId(title) };
        }) ?? [],
    [page],
  );

  return (
    <main className="docs-shell">
      <nav className="docs-nav" aria-label="Documentation">
        <div className="docs-search">
          <Search size={16} aria-hidden="true" />
          <input
            ref={searchField}
            type="search"
            placeholder="Search guides…"
            aria-label="Search documentation"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchField.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
        <p className="docs-nav-title">
          <BookOpen size={14} aria-hidden="true" /> Documentation
        </p>
        <ul className="docs-nav-list">
          {(query.trim() ? results : docsPages).map((entry) => (
            <li key={entry.slug}>
              <AppLink
                className={`docs-nav-link${entry.slug === page?.slug ? " is-current" : ""}`}
                href={docsHref(entry.slug)}
                aria-current={entry.slug === page?.slug ? "page" : undefined}
              >
                <span>{entry.title}</span>
                {query.trim() ? <small>{entry.summary}</small> : null}
              </AppLink>
            </li>
          ))}
        </ul>
        {query.trim() && results.length === 0 ? (
          <p className="docs-no-results" role="status">
            No guides match “{query.trim()}”. Try “download”, “HTML”, or “CLI”.
          </p>
        ) : null}
        <a className="docs-nav-source" href={repositoryUrl} target="_blank" rel="noreferrer">
          <GithubMark /> Source on GitHub
        </a>
      </nav>

      <article className="docs-article">
        {page ? <PageBody page={page} /> : <PageMissing />}
      </article>
      <aside className="docs-outline" aria-label="On this page">
        <span className="docs-outline-title">On this page</span>
        {headings.length ? (
          <ul>
            {headings.map((heading) => (
              <li key={heading.anchor} className={heading.depth === 3 ? "is-nested" : ""}>
                <a href={`#${heading.anchor}`}>{heading.title}</a>
              </li>
            ))}
          </ul>
        ) : (
          <p>Choose a guide to get started.</p>
        )}
        <a
          className="docs-outline-support"
          href="https://github.com/shakthi-sagar/share/issues"
          target="_blank"
          rel="noreferrer"
        >
          Report a problem <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </aside>
    </main>
  );
}

function PageBody({ page }: { page: DocsPage }): React.JSX.Element {
  const index = docsPages.indexOf(page);
  const previous = index > 0 ? docsPages[index - 1] : null;
  const next = index < docsPages.length - 1 ? docsPages[index + 1] : null;
  return (
    <>
      <div className="docs-article-heading">
        <span className="eyebrow">Share / Help center</span>
        <span className="docs-article-reading">
          Guide · {Math.max(1, Math.ceil(page.content.split(/\s+/u).length / 220))} min read
        </span>
      </div>
      <Markdown content={page.content} />
      <nav className="docs-pager" aria-label="Documentation pages">
        {previous ? (
          <AppLink className="docs-pager-link" href={docsHref(previous.slug)}>
            <ArrowLeft size={14} aria-hidden="true" />
            <span>
              <span className="docs-pager-label">Previous</span>
              {previous.title}
            </span>
          </AppLink>
        ) : (
          <span />
        )}
        {next ? (
          <AppLink className="docs-pager-link is-next" href={docsHref(next.slug)}>
            <span>
              <span className="docs-pager-label">Next</span>
              {next.title}
            </span>
            <ArrowRight size={14} aria-hidden="true" />
          </AppLink>
        ) : null}
      </nav>
    </>
  );
}

function PageMissing(): React.JSX.Element {
  return (
    <div className="docs-missing">
      <h1>Page not found</h1>
      <p>That documentation page does not exist.</p>
      <AppLink className="button button-secondary" href={docsHref("")}>
        <ArrowLeft size={15} aria-hidden="true" /> Documentation overview
      </AppLink>
    </div>
  );
}

function Markdown({ content }: { content: string }): React.JSX.Element {
  return (
    <div className="markdown-body docs-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 id={headingId(children)}>{children}</h1>,
          h2: ({ children }) => <h2 id={headingId(children)}>{children}</h2>,
          h3: ({ children }) => <h3 id={headingId(children)}>{children}</h3>,
          pre: ({ children }) => (
            <div className="docs-code-block">
              <div className="docs-code-toolbar">
                <span>Code / Terminal</span>
                <CopyButton value={textOf(children).trimEnd()} label="Copy code" />
              </div>
              <pre>{children}</pre>
            </div>
          ),
          a: ({ href, children }) =>
            isInternalHref(href) ? (
              <AppLink href={href ?? "/"}>{children}</AppLink>
            ) : (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function headingId(children: ReactNode): string {
  return textOf(children)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((child) => textOf(child as ReactNode)).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return "";
}
