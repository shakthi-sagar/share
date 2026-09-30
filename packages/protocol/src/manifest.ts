import { z } from "zod";
import { DEFAULT_CHUNK_SIZE, MAX_MANIFEST_FILES, PROTOCOL_VERSION } from "./constants";

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

/**
 * Characters that change how a path renders without being visible themselves: C0 and C1 controls,
 * DEL, and Unicode bidirectional formatting marks. With them, `invoice‮fdp.exe` displays as
 * `invoiceexe.pdf`.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point.
const invisibleFormatting = /[\u0000-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]/gu;

/**
 * Paths a new share may contain: a safe relative path with no invisible formatting characters.
 * Manifests are still parsed with `isSafeRelativePath` alone, so shares published before this rule
 * stay readable; display those paths through `displayPath`.
 */
export function isPublishablePath(path: string): boolean {
  invisibleFormatting.lastIndex = 0;
  return isSafeRelativePath(path) && !invisibleFormatting.test(path);
}

/** Removes invisible formatting characters, for names that come from outside the user's typing. */
export function removeInvisibleFormatting(value: string): string {
  return value.replace(invisibleFormatting, "");
}

/** Replaces invisible formatting characters with visible `\u{XXXX}` escapes. */
export function displayPath(path: string): string {
  return path.replace(
    invisibleFormatting,
    (character) =>
      `\\u{${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}}`,
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
    files: z.array(manifestFileSchema).max(MAX_MANIFEST_FILES),
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
