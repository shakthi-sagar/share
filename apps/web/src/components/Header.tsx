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
        <a href="https://github.com/shakthi-sagar/share#readme">Docs</a>
        <a href="https://github.com/shakthi-sagar/share#deployment">Self-host</a>
        <a href="https://github.com/shakthi-sagar/share">GitHub</a>
      </nav>
    </header>
  );
}
