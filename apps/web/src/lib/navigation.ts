import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function currentHref(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

export function useLocationHref(): string {
  return useSyncExternalStore(subscribe, currentHref, () => "/");
}

export function isInternalHref(href: string | undefined): boolean {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//");
}

export function isModifiedClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export function navigate(href: string): void {
  if (currentHref() === href) {
    return;
  }
  window.history.pushState(null, "", href);
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Scrolls to the fragment target, or to the top when there is none. Lazy routes render after the
 * first commit, so a missing target is retried for a few frames before giving up.
 */
export function scrollToHref(hash: string): void {
  const id = decodeURIComponent(hash.replace(/^#/u, ""));
  if (!id) {
    window.scrollTo(0, 0);
    return;
  }
  let attempts = 0;
  const attempt = (): void => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView();
      return;
    }
    attempts += 1;
    if (attempts <= 30) {
      requestAnimationFrame(attempt);
    }
  };
  attempt();
}
