export function Header(): React.JSX.Element {
  return (
    <header className="site-header">
      <a className="wordmark" href="/" aria-label="Share home">
        <span className="wordmark-mark" aria-hidden="true">
          /
        </span>
        share
      </a>
      <nav className="site-nav" aria-label="Primary navigation">
        <a href="/docs">Docs</a>
        <a href="/docs/cli">CLI</a>
        <a href="/docs/self-hosting">Self-host</a>
        <a href="https://github.com">GitHub</a>
      </nav>
    </header>
  );
}
