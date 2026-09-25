import { Header } from "./components/Header";
import { Home } from "./routes/Home";
import { Share } from "./routes/Share";

export function App(): React.JSX.Element {
  const shareMatch = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]{22})\/?$/u);
  if (shareMatch?.[1]) {
    return <Share id={shareMatch[1]} />;
  }
  return (
    <div className="app-page">
      <Header />
      <Home />
    </div>
  );
}
