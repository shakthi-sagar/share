import { lazy, Suspense, useEffect } from "react";
import { Header } from "./components/Header";
import { SiteFooter } from "./components/SiteFooter";
import { normalizeDocsSlug } from "./lib/docs";
import { scrollToHref, useLocationHref } from "./lib/navigation";

const Home = lazy(() => import("./routes/Home").then((module) => ({ default: module.Home })));
const Share = lazy(() => import("./routes/Share").then((module) => ({ default: module.Share })));
const WorkspaceEditor = lazy(() =>
  import("./routes/Workspace").then((module) => ({ default: module.WorkspaceEditor })),
);
const Docs = lazy(() => import("./routes/Docs").then((module) => ({ default: module.Docs })));

export function App(): React.JSX.Element {
  const href = useLocationHref();
  const path = window.location.pathname;
  const shareMatch = path.match(/^\/s\/([A-Za-z0-9_-]{22})\/?$/u);
  if (shareMatch?.[1]) {
    return (
      <Suspense fallback={<RouteLoading />}>
        <Share id={shareMatch[1]} />
      </Suspense>
    );
  }
  const workspaceMatch = path.match(/^\/w\/([A-Za-z0-9-]+)\/?$/u);
  if (workspaceMatch?.[1]) {
    return (
      <Suspense fallback={<RouteLoading />}>
        <WorkspaceEditor id={workspaceMatch[1]} />
      </Suspense>
    );
  }
  const isDocs = path === "/docs" || path.startsWith("/docs/");
  return (
    <div className="app-page">
      <Header />
      <ScrollToLocation href={href} />
      <Suspense fallback={<RouteLoading />}>
        {isDocs ? <Docs slug={normalizeDocsSlug(path.replace(/^\/docs/u, ""))} /> : <Home />}
      </Suspense>
      <SiteFooter />
    </div>
  );
}

/** Restores the scroll position for an in-app navigation: the fragment target, or the top. */
function ScrollToLocation({ href }: { href: string }): null {
  useEffect(() => {
    const hashIndex = href.indexOf("#");
    scrollToHref(hashIndex === -1 ? "" : href.slice(hashIndex));
  }, [href]);
  return null;
}

function RouteLoading(): React.JSX.Element {
  return (
    <div className="route-loading" role="status">
      Loading…
    </div>
  );
}
