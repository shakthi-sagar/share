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
const LOCAL_ORIGIN = "https://local.invalid";

/** Resolve relative paths against the containing file inside the share. */
export function resolveHtmlReference(htmlPath: string, reference: string): string | null {
  const relative = reference.trim();
  if (!relative || /^[/#?\\]|^[a-z][a-z\d+.-]*:/iu.test(relative)) return null;
  try {
    const base = htmlPath.split("/").map(encodeURIComponent).join("/");
    const target = new URL(relative, `${LOCAL_ORIGIN}/${base}`);
    if (target.origin !== LOCAL_ORIGIN) return null;
    return decodeURIComponent(target.pathname.slice(1));
  } catch {
    return null;
  }
}

type SourceCandidate = { url: string; descriptor: string };

export function parseSrcset(input: string): SourceCandidate[] {
  const candidates: SourceCandidate[] = [];
  const tokens = /[^\t\n\f\r ,][^\t\n\f\r ]*(?:[\t\n\f\r ]+[^,]*)?/gu;
  let offset = 0;
  while (offset < input.length) {
    tokens.lastIndex = offset;
    const candidate = tokens.exec(input);
    if (!candidate) break;
    const url = /^[^\t\n\f\r ]+/u.exec(candidate[0])?.[0] ?? "";
    offset = candidate.index + Math.max(candidate[0].length, 1);
    if (url.endsWith(",")) {
      offset = candidate.index + url.length;
      candidates.push({ url: url.replace(/,+$/u, ""), descriptor: "" });
      continue;
    }
    const descriptor = candidate[0].slice(url.length).trim();
    if (/^(?:[1-9]\d*w|(?:\d+(?:\.\d+)?|\.\d+)x)?$/u.test(descriptor)) {
      candidates.push({ url, descriptor });
    }
  }
  return candidates;
}

type AssetLoader = (reference: string, from: string) => Promise<string | null>;

// Match CSS URL tokens outside comments and quoted strings. The sandbox blocks any CSS resource
// syntax we do not rewrite, including @import, external URLs, and escaped spellings of url().
const cssTokens =
  /\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|(?<![\w-])url\(\s*(?:"((?:\\[\s\S]|[^"\\])*)"|'((?:\\[\s\S]|[^'\\])*)'|([^"'()]*?))\s*\)/giu;

export async function rewriteCssAssets(
  text: string,
  from: string,
  load: AssetLoader,
): Promise<string> {
  const result: string[] = [];
  let end = 0;
  for (const match of text.matchAll(cssTokens)) {
    const reference = match[1] ?? match[2] ?? match[3];
    if (reference === undefined) continue;
    const url = reference.includes("\\") ? null : await load(reference, from);
    result.push(text.slice(end, match.index), url ? `url(${JSON.stringify(url)})` : 'url("")');
    end = match.index + match[0].length;
  }
  result.push(text.slice(end));
  return result.join("");
}

export type ResolvedHtml = { html: string; urls: string[]; loaded: number; skipped: number };

export async function resolveHtmlAssets(
  text: string,
  context: HtmlAssetContext,
): Promise<ResolvedHtml> {
  // Template contents stay inert while Share rewrites URLs, including before the iframe CSP applies.
  const doc = new DOMParser().parseFromString("<!doctype html><html></html>", "text/html");
  const template = doc.createElement("template");
  template.innerHTML = text;
  const root = template.content;
  const csp = doc.createElement("meta");
  csp.httpEquiv = "Content-Security-Policy";
  csp.content =
    "default-src 'none'; img-src blob: data:; media-src blob:; font-src blob:; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'";

  for (const node of root.querySelectorAll(
    "base,meta[http-equiv],script,iframe,object,embed,[data-share-path]",
  )) {
    if (node.matches("[data-share-path]")) node.removeAttribute("data-share-path");
    if (node.matches("base,meta[http-equiv],script,iframe,object,embed")) node.remove();
  }

  const files = new Map(context.files.map((file) => [file.path, file]));
  const resources = new Map<string, Blob | null>();
  const mappings = new Map<string, string>();
  const urls: string[] = [];
  let bytes = 0;
  let loaded = 0;
  let skipped = 0;

  async function loadBlob(name: string): Promise<Blob | null> {
    if (resources.has(name)) return resources.get(name) ?? null;
    const file = files.get(name);
    if (
      !file ||
      resources.size >= MAX_ASSETS ||
      file.size > MAX_ASSET_BYTES ||
      bytes + file.size > MAX_TOTAL_BYTES
    ) {
      skipped++;
      return null;
    }
    bytes += file.size;
    let blob: Blob | null = null;
    try {
      blob = await context.openFile(file);
      loaded++;
    } catch {
      skipped++;
    }
    resources.set(name, blob);
    return blob;
  }

  const load: AssetLoader = async (reference, from) => {
    const name = resolveHtmlReference(from, reference);
    if (!name) return null;
    const cached = mappings.get(name);
    if (cached) return cached;
    const file = files.get(name);
    const kind = file ? previewKind(file.path, file.mime) : null;
    if (!file || !kind || !["image", "svg", "audio", "video", "font"].includes(kind)) {
      skipped++;
      return null;
    }
    const blob = await loadBlob(name);
    if (!blob) return null;
    const url = URL.createObjectURL(
      new Blob([blob], { type: safeMediaType(kind, file.path, file.mime) }),
    );
    urls.push(url);
    mappings.set(name, url);
    return url;
  };

  try {
    const from = context.path;
    for (const node of root.querySelectorAll("a[href],area[href]")) {
      const raw = node.getAttribute("href") ?? "";
      node.removeAttribute("target");
      node.removeAttribute("download");
      node.removeAttribute("ping");
      if (raw.startsWith("#")) continue;
      const path = resolveHtmlReference(from, raw);
      if (path && files.has(path)) {
        // Native same-document fragment navigation is also a fallback for WebKit, which
        // may not dispatch cross-frame click listeners on sandboxed srcdoc content.
        node.setAttribute("href", `#share-file=${encodeURIComponent(path)}`);
        node.setAttribute("data-share-path", path);
      } else {
        node.removeAttribute("href");
        if (path) skipped++;
      }
    }
    for (const node of root.querySelectorAll(
      "img[src],source[src],video[src],audio[src],video[poster]",
    )) {
      for (const attribute of ["src", "poster"]) {
        const raw = node.getAttribute(attribute);
        if (raw === null) continue;
        const url = await load(raw, from);
        if (url) node.setAttribute(attribute, url);
        else node.removeAttribute(attribute);
      }
    }
    for (const node of root.querySelectorAll("[srcset]")) {
      const values: string[] = [];
      for (const { url, descriptor } of parseSrcset(node.getAttribute("srcset") ?? "")) {
        const resolved = await load(url, from);
        if (resolved) values.push(descriptor ? `${resolved} ${descriptor}` : resolved);
      }
      if (values.length) node.setAttribute("srcset", values.join(", "));
      else node.removeAttribute("srcset");
    }
    for (const node of root.querySelectorAll("style,[style]")) {
      if (node.localName === "style") {
        node.textContent = await rewriteCssAssets(node.textContent ?? "", from, load);
      }
      const inline = node.getAttribute("style");
      if (inline !== null) node.setAttribute("style", await rewriteCssAssets(inline, from, load));
    }
    for (const node of root.querySelectorAll("link")) {
      const name = resolveHtmlReference(from, node.getAttribute("href") ?? "");
      const css =
        name && node.getAttribute("rel")?.toLowerCase() === "stylesheet" && /\.css$/iu.test(name)
          ? await loadBlob(name)
          : null;
      if (css && name) {
        const style = doc.createElement("style");
        const media = node.getAttribute("media");
        if (media) style.setAttribute("media", media);
        style.textContent = (await rewriteCssAssets(await css.text(), name, load)).replace(
          /</gu,
          "\\3c ",
        );
        node.replaceWith(style);
      } else {
        node.remove();
      }
    }

    // Prepend the policy outside the parsed bundle before loading any author content.
    const serialized = template.innerHTML;
    return {
      html: `<!doctype html><head>${csp.outerHTML}</head>${serialized}`,
      urls,
      loaded,
      skipped,
    };
  } catch (error) {
    for (const url of urls) URL.revokeObjectURL(url);
    throw error;
  }
}
