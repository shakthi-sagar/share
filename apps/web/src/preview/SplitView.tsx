import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;
const KEY_STEP = 0.05;

/**
 * Two panes with a draggable divider. The divider is a focusable separator: arrow keys resize,
 * Home and End jump to the limits, and Enter or a double click restores an even split. Scrolling
 * either pane moves the other proportionally, so source and preview stay roughly aligned.
 */
export function SplitView({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: ReactNode;
  right: ReactNode;
  leftLabel: string;
  rightLabel: string;
}): React.JSX.Element {
  const [ratio, setRatio] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const leftPane = useRef<HTMLDivElement>(null);
  const rightPane = useRef<HTMLDivElement>(null);

  const setClamped = useCallback((value: number) => {
    setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, value)));
  }, []);

  useScrollSync(leftPane, rightPane);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const actions: Record<string, () => void> = {
      ArrowLeft: () => setClamped(ratio - KEY_STEP),
      ArrowRight: () => setClamped(ratio + KEY_STEP),
      Home: () => setClamped(MIN_RATIO),
      End: () => setClamped(MAX_RATIO),
      Enter: () => setRatio(0.5),
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  return (
    <div
      ref={container}
      className={`split-view${dragging ? " is-dragging" : ""}`}
      style={{ gridTemplateColumns: `minmax(0, ${ratio}fr) auto minmax(0, ${1 - ratio}fr)` }}
    >
      <section ref={leftPane} className="split-pane" aria-label={leftLabel}>
        {left}
      </section>
      {/* biome-ignore lint/a11y/useSemanticElements: an <hr> cannot be focused or dragged. */}
      <div
        className="split-divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panes"
        aria-valuemin={MIN_RATIO * 100}
        aria-valuemax={MAX_RATIO * 100}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onDoubleClick={() => setRatio(0.5)}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (!dragging || !container.current) return;
          const bounds = container.current.getBoundingClientRect();
          setClamped((event.clientX - bounds.left) / bounds.width);
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
      />
      <section ref={rightPane} className="split-pane" aria-label={rightLabel}>
        {right}
      </section>
    </div>
  );
}

/**
 * Keeps the scroll position of the two panes proportional. Each pane marks its scrolling element
 * with `data-scroll-sync`, or scrolls itself.
 */
function useScrollSync(
  left: React.RefObject<HTMLDivElement | null>,
  right: React.RefObject<HTMLDivElement | null>,
): void {
  useEffect(() => {
    const leftPane = left.current;
    const rightPane = right.current;
    if (!leftPane || !rightPane) return;
    let driver: HTMLElement | null = null;
    let release = 0;

    const scroller = (pane: HTMLElement): HTMLElement =>
      pane.querySelector<HTMLElement>("[data-scroll-sync]") ?? pane;

    const follow = (source: HTMLElement, target: HTMLElement): void => {
      const range = source.scrollHeight - source.clientHeight;
      const targetRange = target.scrollHeight - target.clientHeight;
      if (range <= 0 || targetRange <= 0) return;
      target.scrollTop = (source.scrollTop / range) * targetRange;
    };

    const handler = (from: HTMLElement, to: HTMLElement) => (event: Event) => {
      const source = event.target as HTMLElement;
      if (driver && driver !== from) return;
      driver = from;
      window.clearTimeout(release);
      release = window.setTimeout(() => {
        driver = null;
      }, 120);
      follow(source, scroller(to));
    };

    const onLeft = handler(leftPane, rightPane);
    const onRight = handler(rightPane, leftPane);
    // Scroll events do not bubble, so listen in the capture phase to catch nested scrollers.
    leftPane.addEventListener("scroll", onLeft, true);
    rightPane.addEventListener("scroll", onRight, true);
    return () => {
      window.clearTimeout(release);
      leftPane.removeEventListener("scroll", onLeft, true);
      rightPane.removeEventListener("scroll", onRight, true);
    };
  }, [left, right]);
}
