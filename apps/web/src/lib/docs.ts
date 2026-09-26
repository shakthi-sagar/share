import overview from "../content/docs/overview.md?raw";
import security from "../content/docs/security.md?raw";
import selfHost from "../content/docs/self-host.md?raw";
import usingShare from "../content/docs/using-share.md?raw";

export type DocsPage = {
  /** Path segment under `/docs`. The overview page uses the empty segment. */
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly content: string;
};

const pages: readonly DocsPage[] = [
  {
    slug: "",
    title: "Overview",
    summary: "What share is and how a published link works.",
    content: overview,
  },
  {
    slug: "using-share",
    title: "Using share",
    summary: "Workspaces, publishing a snapshot, and opening a link.",
    content: usingShare,
  },
  {
    slug: "security",
    title: "Security model",
    summary: "Trust boundary, key schedule, and the rules that must hold.",
    content: security,
  },
  {
    slug: "self-host",
    title: "Self-host",
    summary: "Deploy the Worker, D1 metadata, and private R2 storage.",
    content: selfHost,
  },
];

export const docsPages = pages;

export function docsHref(slug: string): string {
  return slug ? `/docs/${slug}` : "/docs";
}

export function findDocsPage(slug: string): DocsPage | null {
  return pages.find((page) => page.slug === slug) ?? null;
}

export function normalizeDocsSlug(value: string | undefined): string {
  return (value ?? "").replace(/^\/+|\/+$/gu, "").toLowerCase();
}
