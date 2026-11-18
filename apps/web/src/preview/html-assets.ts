import type { ManifestFile } from "@share/protocol";
import { previewKind, safeMediaType } from "./kinds";

export type HtmlAssetContext = {
  path: string;
  files: ManifestFile[];
  openFile: (file: ManifestFile) => Promise<Blob>;
  onOpenFile?: (file: ManifestFile) => void;
};

const MAX_ASSETS = 40;
const MAX_ASSET_BYTES = 24 * 1024 * 1024;
const MAX_TOTAL_BYTES = 96 * 1024 * 1024;

/** Resolve local relative paths against the HTML file's directory, not the Share website URL. */
export function resolveHtmlReference(htmlPath: string, reference: string): string | null {
  if (
    !reference ||
    reference.startsWith("#") ||
    reference.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/iu.test(reference) ||
    reference.startsWith("/")
  )
    return null;
  let target: URL;
  try {
    target = new URL(reference, `https://local.invalid/${htmlPath}`);
    if (target.origin !== "https://local.invalid") return null;
  } catch {
    return null;
  }
  try {
    return decodeURIComponent(target.pathname.slice(1));
  } catch {
    return null;
  }
}

/** Find only references the preview can safely inline or associate with local encrypted files. */
export function htmlReferences(text: string, htmlPath: string): string[] {
  const parsed = new DOMParser().parseFromString(text, "text/html");
  const names = new Set<string>();
  for (const node of parsed.querySelectorAll(
    "img[src],a[href],source[src],video[src],audio[src],video[poster],link[href]",
  )) {
    const attribute = node.hasAttribute("src")
      ? "src"
      : node.hasAttribute("poster")
        ? "poster"
        : "href";
    const resolved = resolveHtmlReference(htmlPath, node.getAttribute(attribute) ?? "");
    if (resolved) names.add(resolved);
  }
  return [...names];
}

export type ResolvedHtml = { html: string; urls: string[]; loaded: number; skipped: number };

/** Creates scoped blob URLs for decrypted resources; caller must revoke the returned URLs. */
export async function resolveHtmlAssets(
  text: string,
  context: HtmlAssetContext,
): Promise<ResolvedHtml> {
  const doc = new DOMParser().parseFromString(text, "text/html");
  // Keep the iframe isolated even though blob URLs require same-origin to resolve.
  // Scripts, network access, forms, nested frames, and remote resources remain disallowed.
  const csp = doc.createElement("meta");
  csp.setAttribute("http-equiv", "Content-Security-Policy");
  csp.setAttribute(
    "content",
    "default-src 'none'; img-src blob: data:; media-src blob:; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'",
  );
  doc.head.prepend(csp);
  // A <base> must never redirect relative assets to an outside site.
  for (const node of doc.querySelectorAll(
    "base,meta[http-equiv=refresh],script,iframe,object,embed",
  ))
    node.remove();
  for (const node of doc.querySelectorAll("[srcset]")) node.removeAttribute("srcset");
  const files = new Map(context.files.map((file) => [file.path, file]));
  const refs = htmlReferences(text, context.path);
  const mappings = new Map<string, string>();
  const styles = new Map<string, string>();
  const urls: string[] = [];
  let bytes = 0;
  let skipped = 0;

  try {
    for (const name of refs) {
      const file = files.get(name);
      if (
        !file ||
        mappings.size + styles.size >= MAX_ASSETS ||
        file.size > MAX_ASSET_BYTES ||
        bytes + file.size > MAX_TOTAL_BYTES
      ) {
        skipped++;
        continue;
      }
      const kind = previewKind(file.path, file.mime);
      const css = /\.css$/iu.test(name);
      if (!css && !["image", "svg", "audio", "video"].includes(kind)) {
        skipped++;
        continue;
      }
      bytes += file.size;
      try {
        const blob = await context.openFile(file);
        if (css) styles.set(name, await blob.text());
        else {
          const url = URL.createObjectURL(
            new Blob([blob], {
              type: safeMediaType(kind, file.path, file.mime),
            }),
          );
          urls.push(url);
          mappings.set(name, url);
        }
      } catch {
        skipped++;
      }
    }

    for (const node of doc.querySelectorAll(
      "img[src],a[href],source[src],video[src],audio[src],video[poster],link[href]",
    )) {
      const attribute = node.hasAttribute("src")
        ? "src"
        : node.hasAttribute("poster")
          ? "poster"
          : "href";
      const raw = node.getAttribute(attribute) ?? "";
      if (attribute === "href" && raw.startsWith("#")) continue;
      const name = resolveHtmlReference(context.path, raw);
      if (node.matches("link[rel=stylesheet]")) {
        if (name && styles.has(name)) {
          const style = doc.createElement("style");
          style.textContent = styles.get(name) ?? "";
          node.replaceWith(style);
        } else node.remove();
        continue;
      }
      const value = name ? mappings.get(name) : null;
      if (value) {
        if (node.tagName === "A") {
          // Navigation to blob URLs is blocked by the sandbox. The parent viewer intercepts
          // this local-only reference and switches to its full-resolution file preview.
          node.setAttribute("href", "#");
          if (name) node.setAttribute("data-share-path", name);
          node.removeAttribute("target");
          node.removeAttribute("download");
        } else node.setAttribute(attribute, value);
      } else if (attribute === "href") {
        node.removeAttribute(attribute);
        node.removeAttribute("target");
      } else {
        node.removeAttribute(attribute);
      }
    }
    return {
      html: `<!doctype html>\n${doc.documentElement.outerHTML}`,
      urls,
      loaded: mappings.size + styles.size,
      skipped,
    };
  } catch (error) {
    for (const url of urls) URL.revokeObjectURL(url);
    throw error;
  }
}
