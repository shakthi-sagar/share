import { docsHref, docsPages } from "../lib/docs";
import { repositoryPath, repositoryUrl } from "../lib/links";
import { AppLink } from "./AppLink";

export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-identity">
          <span className="wordmark">
            <span className="wordmark-mark" aria-hidden="true">
              /
            </span>
            share
          </span>
          <p>
            End-to-end encrypted artifact sharing. The service stores ciphertext, never filenames or
            file content.
          </p>
        </div>
        <nav className="site-footer-links" aria-label="Footer">
          <div>
            <h2>Documentation</h2>
            <ul>
              {docsPages.map((page) => (
                <li key={page.slug}>
                  <AppLink href={docsHref(page.slug)}>{page.title}</AppLink>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Project</h2>
            <ul>
              <li>
                <a href={repositoryUrl} target="_blank" rel="noreferrer">
                  Repository
                </a>
              </li>
              <li>
                <a href={repositoryPath("issues")} target="_blank" rel="noreferrer">
                  Issues
                </a>
              </li>
              <li>
                <a href={repositoryPath("blob/main/LICENSE")} target="_blank" rel="noreferrer">
                  License
                </a>
              </li>
              <li>
                <a href={repositoryPath("security/policy")} target="_blank" rel="noreferrer">
                  Security policy
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </footer>
  );
}
