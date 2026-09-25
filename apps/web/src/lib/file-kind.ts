export type FilePreviewKind = "markdown" | "text" | "image" | "binary";

export function filePreviewKind(path: string, mime: string): FilePreviewKind {
  if (mime === "text/markdown" || /\.mdx?$/iu.test(path)) return "markdown";
  if (mime.startsWith("image/") && mime !== "image/svg+xml") return "image";
  if (
    mime.startsWith("text/") ||
    /\.(?:json|ya?ml|js|jsx|ts|tsx|css|html|xml|svg|sql|sh|py|go|rs|java|c|cpp|h)$/iu.test(path)
  ) {
    return "text";
  }
  return "binary";
}
