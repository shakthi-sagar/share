import { lazy, Suspense } from "react";
import { Header } from "./components/Header";

const Home = lazy(() => import("./routes/Home").then((module) => ({ default: module.Home })));
const Share = lazy(() => import("./routes/Share").then((module) => ({ default: module.Share })));
const WorkspaceEditor = lazy(() =>
  import("./routes/Workspace").then((module) => ({ default: module.WorkspaceEditor })),
);

export function App(): React.JSX.Element {
  const shareMatch = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]{22})\/?$/u);
  if (shareMatch?.[1]) {
    return (
      <Suspense fallback={<RouteLoading />}>
        <Share id={shareMatch[1]} />
      </Suspense>
    );
  }
  const workspaceMatch = window.location.pathname.match(/^\/w\/([A-Za-z0-9-]+)\/?$/u);
  if (workspaceMatch?.[1]) {
    return (
      <Suspense fallback={<RouteLoading />}>
        <WorkspaceEditor id={workspaceMatch[1]} />
      </Suspense>
    );
  }
  return (
    <div className="app-page">
      <Header />
      <Suspense fallback={<RouteLoading />}>
        <Home />
      </Suspense>
    </div>
  );
}

function RouteLoading(): React.JSX.Element {
  return (
    <div className="route-loading" role="status">
      Loading…
    </div>
  );
}
