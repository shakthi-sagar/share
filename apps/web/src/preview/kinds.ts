/**
 * How a file is shown. Text kinds are decoded and rendered by this app; media kinds are handed to
 * the browser through a blob URL with a type this app chose; `binary` means download only.
 */
export type PreviewKind =
  | "markdown"
  | "csv"
  | "json"
  | "svg"
  | "html"
  | "code"
  | "text"
  | "image"
  | "pdf"
  | "audio"
  | "video"
  | "font"
  | "binary";

/** Kinds decoded as UTF-8 text. They can be edited in a workspace and shown as source. */
const textKinds = new Set<PreviewKind>(["markdown", "csv", "json", "svg", "html", "code", "text"]);

/** Text kinds with a rendered view in addition to their source. */
const renderedKinds = new Set<PreviewKind>(["markdown", "csv", "json", "svg", "html"]);

export function isTextKind(kind: PreviewKind): boolean {
  return textKinds.has(kind);
}

export function hasRenderedView(kind: PreviewKind): boolean {
  return renderedKinds.has(kind);
}

/**
 * Largest file each kind decrypts for preview. Past it the file is offered as a download, so a
 * preview never holds an arbitrarily large share in memory.
 */
export const PREVIEW_LIMIT_BYTES: Record<PreviewKind, number> = {
  markdown: 5 * 1024 * 1024,
  csv: 20 * 1024 * 1024,
  json: 10 * 1024 * 1024,
  svg: 10 * 1024 * 1024,
  html: 5 * 1024 * 1024,
  code: 10 * 1024 * 1024,
  text: 10 * 1024 * 1024,
  image: 64 * 1024 * 1024,
  pdf: 128 * 1024 * 1024,
  audio: 256 * 1024 * 1024,
  video: 512 * 1024 * 1024,
  font: 16 * 1024 * 1024,
  binary: 0,
};

/** Unknown files up to this size are decrypted and checked for text before falling back to download. */
export const SNIFF_LIMIT_BYTES = 2 * 1024 * 1024;

/** Extension → highlight.js language. Also decides that a file is code. */
const codeLanguages: Record<string, string> = {
  bash: "bash",
  bat: "dos",
  c: "c",
  cc: "cpp",
  cfg: "ini",
  cjs: "javascript",
  clj: "clojure",
  cmake: "cmake",
  conf: "ini",
  cpp: "cpp",
  cs: "csharp",
  css: "css",
  cts: "typescript",
  dart: "dart",
  diff: "diff",
  dockerfile: "dockerfile",
  elm: "elm",
  env: "bash",
  erl: "erlang",
  ex: "elixir",
  exs: "elixir",
  fish: "bash",
  fs: "fsharp",
  go: "go",
  gradle: "gradle",
  graphql: "graphql",
  gql: "graphql",
  groovy: "groovy",
  h: "c",
  hpp: "cpp",
  hs: "haskell",
  ini: "ini",
  java: "java",
  jl: "julia",
  js: "javascript",
  jsonc: "json",
  json5: "json",
  jsx: "javascript",
  kt: "kotlin",
  kts: "kotlin",
  less: "less",
  lua: "lua",
  m: "objectivec",
  makefile: "makefile",
  mjs: "javascript",
  mk: "makefile",
  ml: "ocaml",
  mm: "objectivec",
  mts: "typescript",
  nginx: "nginx",
  nim: "nim",
  nix: "nix",
  patch: "diff",
  php: "php",
  pl: "perl",
  prisma: "prisma",
  properties: "properties",
  proto: "protobuf",
  ps1: "powershell",
  py: "python",
  r: "r",
  rb: "ruby",
  rs: "rust",
  sass: "scss",
  scala: "scala",
  scss: "scss",
  sh: "bash",
  sol: "solidity",
  sql: "sql",
  svelte: "xml",
  swift: "swift",
  tex: "latex",
  tf: "hcl",
  toml: "ini",
  ts: "typescript",
  tsx: "typescript",
  vb: "vbnet",
  vim: "vim",
  vue: "xml",
  xml: "xml",
  xsl: "xml",
  yaml: "yaml",
  yml: "yaml",
  zig: "zig",
  zsh: "bash",
};

/** Whole file names that are code without an extension. */
const codeFileNames: Record<string, string> = {
  dockerfile: "dockerfile",
  containerfile: "dockerfile",
  makefile: "makefile",
  gnumakefile: "makefile",
  justfile: "makefile",
  gemfile: "ruby",
  rakefile: "ruby",
  procfile: "bash",
  ".bashrc": "bash",
  ".zshrc": "bash",
  ".profile": "bash",
  ".env": "bash",
  ".gitignore": "bash",
  ".gitattributes": "bash",
  ".dockerignore": "bash",
  ".editorconfig": "ini",
  ".npmrc": "ini",
};

const plainTextExtensions = new Set(["txt", "text", "log", "rst", "adoc", "org", "lock", "csr"]);
const plainTextNames = new Set(["license", "licence", "copying", "readme", "authors", "notice"]);
const imageExtensions = new Set([
  "apng",
  "avif",
  "bmp",
  "gif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "webp",
]);
const audioExtensions = new Set(["aac", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav", "weba"]);
const videoExtensions = new Set(["m4v", "mov", "mp4", "ogv", "webm"]);
const fontExtensions = new Set(["otf", "ttf", "woff", "woff2"]);

/** Formats browsers cannot decode, even with an image or media MIME type. */
const undecodable = new Set([
  "heic",
  "heif",
  "tif",
  "tiff",
  "psd",
  "raw",
  "cr2",
  "nef",
  "avi",
  "mkv",
  "wmv",
]);

export function fileName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

export function extensionOf(path: string): string {
  const name = fileName(path).toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1) : "";
}

export function previewKind(path: string, mime: string): PreviewKind {
  const name = fileName(path).toLowerCase();
  const extension = extensionOf(path);
  const type = mime.toLowerCase().split(";")[0]?.trim() ?? "";

  if (undecodable.has(extension)) return "binary";
  if (extension === "md" || extension === "mdx" || extension === "markdown") return "markdown";
  if (type === "text/markdown") return "markdown";
  if (extension === "csv" || extension === "tsv" || type === "text/csv") return "csv";
  if (type === "text/tab-separated-values") return "csv";
  if (extension === "json" || extension === "geojson" || extension === "ipynb") return "json";
  if (type === "application/json") return "json";
  if (extension === "svg" || type === "image/svg+xml") return "svg";
  if (extension === "html" || extension === "htm" || type === "text/html") return "html";
  if (extension === "pdf" || type === "application/pdf") return "pdf";
  if (imageExtensions.has(extension)) return "image";
  if (audioExtensions.has(extension)) return "audio";
  if (videoExtensions.has(extension)) return "video";
  if (fontExtensions.has(extension) || type.startsWith("font/")) return "font";
  if (codeLanguages[extension] || codeFileNames[name]) return "code";
  if (plainTextExtensions.has(extension) || plainTextNames.has(name)) return "text";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("text/") || /\+(?:json|xml)$/u.test(type)) return "text";
  return "binary";
}

/** The highlight.js language for a file, or undefined for plain text. */
export function languageFor(path: string): string | undefined {
  const name = fileName(path).toLowerCase();
  return codeFileNames[name] ?? codeLanguages[extensionOf(path)];
}

/**
 * Decides whether bytes from an unknown file are text worth showing: valid UTF-8 with no NUL and
 * few control characters. Only the first 8 KiB are examined.
 */
export function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 8192);
  let control = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32)) control += 1;
  }
  if (control > sample.byteLength / 100) return false;
  try {
    // A multi-byte character may be cut at the sample boundary; `stream` tolerates the tail.
    new TextDecoder("utf-8", { fatal: true }).decode(sample, { stream: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * The MIME type a blob URL is given when a kind is handed to the browser. It comes from the kind,
 * never from the sender's manifest, so a file cannot choose to be interpreted as HTML.
 */
export function safeMediaType(kind: PreviewKind, path: string, mime: string): string {
  const extension = extensionOf(path);
  const type = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  switch (kind) {
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    case "image":
      return type.startsWith("image/") && type !== "image/svg+xml"
        ? type
        : `image/${extension === "jpg" ? "jpeg" : extension || "png"}`;
    case "audio":
      return type.startsWith("audio/") ? type : `audio/${extension === "mp3" ? "mpeg" : extension}`;
    case "video":
      return type.startsWith("video/")
        ? type
        : `video/${extension === "mov" ? "quicktime" : extension === "m4v" ? "mp4" : extension}`;
    default:
      return "application/octet-stream";
  }
}
