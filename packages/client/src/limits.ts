import {
  encodeBase64Url,
  encryptedFileBytes,
  encryptedManifestBytes,
  generateFileNoncePrefix,
} from "@share/crypto";
import {
  DEFAULT_CHUNK_SIZE,
  isPublishablePath,
  MAX_MANIFEST_CIPHERTEXT_BYTES,
  MAX_MANIFEST_FILES,
  MAX_SHARE_CHUNKS,
  PROTOCOL_VERSION,
  type ShareManifest,
} from "@share/protocol";
import type { ShareSourceFile } from "./types";

export type ShareLimitCode =
  | "NO_FILES"
  | "TOO_MANY_FILES"
  | "INVALID_NAME"
  | "UNSAFE_PATH"
  | "DUPLICATE_PATH"
  | "INVALID_SIZE"
  | "MANIFEST_TOO_LARGE"
  | "SHARE_TOO_LARGE";

/** A share that cannot be published as described. Raised before anything is sent to the API. */
export class ShareLimitError extends Error {
  readonly code: ShareLimitCode;

  constructor(code: ShareLimitCode, message: string) {
    super(message);
    this.name = "ShareLimitError";
    this.code = code;
  }
}

export interface ShareMeasurement {
  fileCount: number;
  plaintextBytes: number;
  chunkCount: number;
  manifestBytes: number;
  /** Everything the API will store: file chunks plus the encrypted manifest. */
  ciphertextBytes: number;
}

type SourceShape = Pick<ShareSourceFile, "path" | "mime" | "size">;

/**
 * Builds the manifest a share will publish, with fresh object ids and nonce prefixes. The plan is
 * fixed before upload so its encrypted size, and so the whole share's size, is known up front.
 */
export function planManifest(name: string, files: readonly SourceShape[]): ShareManifest {
  validateSources(name, files);
  return {
    version: PROTOCOL_VERSION,
    name,
    files: files.map((source) => ({
      id: encodeBase64Url(crypto.getRandomValues(new Uint8Array(16))),
      path: source.path,
      mime: source.mime || "application/octet-stream",
      size: source.size,
      chunkSize: DEFAULT_CHUNK_SIZE,
      chunks: Math.ceil(source.size / DEFAULT_CHUNK_SIZE),
      noncePrefix: generateFileNoncePrefix(),
    })),
  };
}

export function measureManifest(manifest: ShareManifest): ShareMeasurement {
  const manifestBytes = encryptedManifestBytes(manifest);
  let plaintextBytes = 0;
  let chunkCount = 0;
  let fileCiphertextBytes = 0;
  for (const file of manifest.files) {
    plaintextBytes += file.size;
    chunkCount += file.chunks;
    fileCiphertextBytes += encryptedFileBytes(file.size, file.chunkSize);
  }
  return {
    fileCount: manifest.files.length,
    plaintextBytes,
    chunkCount,
    manifestBytes,
    ciphertextBytes: fileCiphertextBytes + manifestBytes,
  };
}

/** Measures a prospective share without encrypting or uploading anything. */
export function measureShare(name: string, files: readonly SourceShape[]): ShareMeasurement {
  return measureManifest(planManifest(name, files));
}

/**
 * Throws a `ShareLimitError` when a measured share cannot be published. `maxShareBytes` is the
 * operator's limit; the API enforces it too, so checking here only avoids a wasted upload.
 */
export function assertShareWithinLimits(
  measurement: ShareMeasurement,
  maxShareBytes?: number,
): void {
  if (measurement.manifestBytes > MAX_MANIFEST_CIPHERTEXT_BYTES) {
    throw new ShareLimitError(
      "MANIFEST_TOO_LARGE",
      "The file list is too large to publish. Use fewer files or shorter paths.",
    );
  }
  if (measurement.chunkCount > MAX_SHARE_CHUNKS) {
    throw new ShareLimitError("SHARE_TOO_LARGE", "The share has too many chunks to publish");
  }
  if (maxShareBytes !== undefined && measurement.ciphertextBytes > maxShareBytes) {
    throw new ShareLimitError("SHARE_TOO_LARGE", "The share is larger than this service allows");
  }
}

function validateSources(name: string, files: readonly SourceShape[]): void {
  if (name.length === 0 || name.length > 255) {
    throw new ShareLimitError("INVALID_NAME", "The share name must be 1 to 255 characters");
  }
  if (files.length === 0) {
    throw new ShareLimitError("NO_FILES", "At least one file is required");
  }
  if (files.length > MAX_MANIFEST_FILES) {
    throw new ShareLimitError(
      "TOO_MANY_FILES",
      `A share can contain at most ${MAX_MANIFEST_FILES.toLocaleString("en-US")} files`,
    );
  }
  const paths = new Set<string>();
  for (const file of files) {
    if (!isPublishablePath(file.path)) {
      throw new ShareLimitError("UNSAFE_PATH", `Unsafe file path: ${JSON.stringify(file.path)}`);
    }
    if (!Number.isSafeInteger(file.size) || file.size < 0) {
      throw new ShareLimitError("INVALID_SIZE", `Invalid file size: ${file.path}`);
    }
    if (paths.has(file.path)) {
      throw new ShareLimitError("DUPLICATE_PATH", `Duplicate file path: ${file.path}`);
    }
    paths.add(file.path);
  }
}
