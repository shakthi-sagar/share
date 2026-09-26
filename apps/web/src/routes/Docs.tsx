import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppLink } from "../components/AppLink";
import { GithubMark } from "../components/GithubMark";
import { type DocsPage, docsHref, docsPages, findDocsPage } from "../lib/docs";
import { repositoryUrl } from "../lib/links";
import { isInternalHref } from "../lib/navigation";

export function Docs({ slug }: { slug: string }): React.JSX.Element {
  const page = findDocsPage(slug);
  return (
    <main className="docs-shell">
      <nav className="docs-nav" aria-label="Documentation">
        <p className="docs-nav-title">
          <BookOpen size={14} aria-hidden="true" /> Documentation
        </p>
        <ul className="docs-nav-list">
          {docsPages.map((entry) => (
            <li key={entry.slug}>
              <AppLink
                className={`docs-nav-link${entry.slug === page?.slug ? " is-current" : ""}`}
                href={docsHref(entry.slug)}
                aria-current={entry.slug === page?.slug ? "page" : undefined}
              >
                {entry.title}
              </AppLink>
            </li>
          ))}
        </ul>
        <a className="docs-nav-source" href={repositoryUrl} target="_blank" rel="noreferrer">
          <GithubMark /> Source on GitHub
        </a>
      </nav>

      <article className="docs-article">
        {page ? <PageBody page={page} /> : <PageMissing />}
      </article>
    </main>
  );
}

function PageBody({ page }: { page: DocsPage }): React.JSX.Element {
  const index = docsPages.indexOf(page);
  const previous = index > 0 ? docsPages[index - 1] : null;
  const next = index < docsPages.length - 1 ? docsPages[index + 1] : null;
  return (
    <>
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
