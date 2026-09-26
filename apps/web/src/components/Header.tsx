import { BookOpen, Server } from "lucide-react";
import { docsHref } from "../lib/docs";
import { repositoryUrl } from "../lib/links";
import { AppLink } from "./AppLink";
import { GithubMark } from "./GithubMark";

export function Header(): React.JSX.Element {
  return (
    <header className="site-header">
      <AppLink className="wordmark" href="/" aria-label="Share home">
        <span className="wordmark-mark" aria-hidden="true">
          /
        </span>
        share
      </AppLink>
      <nav className="site-nav" aria-label="Primary">
        <AppLink href={docsHref("")}>
          <BookOpen size={14} aria-hidden="true" /> Docs
        </AppLink>
        <AppLink href={docsHref("self-host")}>
          <Server size={14} aria-hidden="true" /> Self-host
        </AppLink>
        <a href={repositoryUrl} target="_blank" rel="noreferrer">
          <GithubMark /> GitHub
        </a>
      </nav>
    </header>
  );
}
