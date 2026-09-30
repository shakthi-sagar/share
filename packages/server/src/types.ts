import type { CompleteShareRequest } from "@share/protocol";

export type ShareState = "uploading" | "ready";

export interface ShareRecord {
  id: string;
  state: ShareState;
  formatVersion: number;
  uploadTokenHash: string;
  deleteTokenHash: string;
  accessCredentialHash: string | null;
  objectCount: number;
  chunkCount: number;
  ciphertextBytes: number;
  /** Ciphertext bytes the server accepted during upload, counted as each body arrives. */
  reservedBytes: number;
  /** Chunk uploads the server accepted. Retries count again, so this is an upper bound. */
  reservedChunks: number;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
}

export interface MetadataStore {
  create(record: ShareRecord): Promise<void>;
  find(id: string): Promise<ShareRecord | null>;
  complete(id: string, completion: CompleteShareRequest, completedAt: string): Promise<boolean>;
  /**
   * Atomically adds to an uploading share's reserved totals when the result stays within `limits`.
   * Returns false, changing nothing, when the share is not uploading or a limit would be exceeded.
   */
  reserve(id: string, reservation: UploadReservation, limits: UploadLimits): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  /**
   * Lists ids the sweep may delete, bounded by `limit`: shares whose expiry is at or before
   * `expiredAt`, and shares still uploading that were created at or before `abandonedBefore`.
   */
  listPurgeable(expiredAt: string, abandonedBefore: string, limit: number): Promise<string[]>;
}

export interface UploadReservation {
  bytes: number;
  chunks: number;
}

export interface UploadLimits {
  maxBytes: number;
  maxChunks: number;
}

export interface StoredBlob {
  body: ReadableStream<Uint8Array>;
  size: number;
  etag: string;
}

export interface BlobStore {
  put(key: string, body: ArrayBuffer | ReadableStream<Uint8Array>): Promise<void>;
  exists(key: string): Promise<boolean>;
  get(key: string): Promise<StoredBlob | null>;
  removePrefix(prefix: string): Promise<void>;
}
