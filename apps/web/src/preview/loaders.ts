import type { HLJSApi } from "highlight.js";
import type { Mermaid } from "mermaid";
import { useEffect, useState } from "react";

/*
 * Heavy renderers load on first use, so a share with no code, diagrams, or PDFs never downloads
 * them. Each loader is memoized; a failed load is retried on the next call.
 */

let highlighter: Promise<HLJSApi> | null = null;

export function loadHighlighter(): Promise<HLJSApi> {
  highlighter ??= import("highlight.js").then(
    (module) => module.default,
    (error: unknown) => {
      highlighter = null;
      throw error;
    },
  );
  return highlighter;
}

let mermaid: Promise<Mermaid> | null = null;

export function loadMermaid(): Promise<Mermaid> {
  mermaid ??= import("mermaid").then(
    ({ default: instance }) => {
      instance.initialize({
        startOnLoad: false,
        // Strict escapes labels and disables click handlers. The SVG is still shown only as an
        // image, where no script can run, so a diagram from a share can never touch this page.
        securityLevel: "strict",
        // HTML labels use foreignObject, which renders inconsistently inside an image.
        htmlLabels: false,
        flowchart: { htmlLabels: false },
        theme: "neutral",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        maxTextSize: 200_000,
      });
      return instance;
    },
    (error: unknown) => {
      mermaid = null;
      throw error;
    },
  );
  return mermaid;
}

/** Resolves to the highlighter once loaded, or null while loading, disabled, or unavailable. */
export function useHighlighter(enabled: boolean): HLJSApi | null {
  const [instance, setInstance] = useState<HLJSApi | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loadHighlighter()
      .then((loaded) => {
        if (active) setInstance(loaded);
      })
      .catch(() => {
        // Plain text is a complete fallback.
      });
    return () => {
      active = false;
    };
  }, [enabled]);
  return enabled ? instance : null;
}
