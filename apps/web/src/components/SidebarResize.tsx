import { useRef } from "react";

export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 440;

export function SidebarResize({
  width,
  onResize,
}: {
  width: number;
  onResize: (width: number) => void;
}): React.JSX.Element {
  const start = useRef<{ x: number; width: number } | null>(null);
  const resize = (value: number) => onResize(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, value)));
  return (
    <hr
      className="sidebar-grip"
      aria-label="Resize file sidebar"
      aria-orientation="vertical"
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        start.current = { x: event.clientX, width };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (start.current) resize(start.current.width + event.clientX - start.current.x);
      }}
      onLostPointerCapture={() => {
        start.current = null;
      }}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        if (event.key === "Home") resize(SIDEBAR_MIN);
        else if (event.key === "End") resize(SIDEBAR_MAX);
        else resize(width + (event.key === "ArrowRight" ? 16 : -16));
      }}
    />
  );
}
