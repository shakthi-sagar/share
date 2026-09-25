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
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
}

export interface MetadataStore {
  create(record: ShareRecord): Promise<void>;
  find(id: string): Promise<ShareRecord | null>;
  complete(id: string, completion: CompleteShareRequest, completedAt: string): Promise<boolean>;
  remove(id: string): Promise<boolean>;
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
