import { z } from "zod";
import { DEFAULT_CHUNK_SIZE, PROTOCOL_VERSION } from "./constants";

const opaqueId = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);
const base64Url = z.string().regex(/^[A-Za-z0-9_-]+$/);

export function isSafeRelativePath(path: string): boolean {
  if (path.length === 0 || path.length > 1024 || path.startsWith("/") || path.includes("\\")) {
    return false;
  }

  const segments = path.split("/");
  return segments.every(
    (segment) =>
      segment.length > 0 && segment !== "." && segment !== ".." && !segment.includes("\0"),
  );
}

export const manifestFileSchema = z.object({
  id: opaqueId,
  path: z.string().refine(isSafeRelativePath, "File path must be a safe relative path"),
  mime: z.string().min(1).max(255),
  size: z.number().int().nonnegative().safe(),
  chunkSize: z.number().int().positive().max(DEFAULT_CHUNK_SIZE),
  chunks: z.number().int().nonnegative().max(0xffff_ffff),
  noncePrefix: base64Url,
});

export const shareManifestSchema = z
  .object({
    version: z.literal(PROTOCOL_VERSION),
    name: z.string().min(1).max(255),
    files: z.array(manifestFileSchema).max(10_000),
  })
  .superRefine((manifest, context) => {
    const paths = new Set<string>();
    const ids = new Set<string>();

    for (const [index, file] of manifest.files.entries()) {
      if (paths.has(file.path)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate file path: ${file.path}`,
          path: ["files", index, "path"],
        });
      }
      if (ids.has(file.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate file id: ${file.id}`,
          path: ["files", index, "id"],
        });
      }
      paths.add(file.path);
      ids.add(file.id);
    }
  });

export type ManifestFile = z.infer<typeof manifestFileSchema>;
export type ShareManifest = z.infer<typeof shareManifestSchema>;
