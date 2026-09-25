import type { ManifestFile, ShareManifest } from "@share/protocol";

export interface ShareSourceFile {
  path: string;
  mime: string;
  size: number;
  stream(): ReadableStream<Uint8Array>;
}

export type ShareProgress =
  | { stage: "creating" }
  | { stage: "encrypting"; path: string; processedBytes: number; totalBytes: number }
  | { stage: "uploading"; path: string; uploadedChunks: number; totalChunks: number }
  | { stage: "finalizing" }
  | { stage: "complete" };

export interface CreateShareOptions {
  apiBaseUrl: string;
  shareBaseUrl: string;
  name: string;
  files: ShareSourceFile[];
  expiresInSeconds: number | null;
  masterKey?: Uint8Array;
  fetch?: typeof globalThis.fetch;
  onProgress?: (progress: ShareProgress) => void;
}

export interface CreatedShare {
  id: string;
  key: string;
  url: string;
  urlWithKey: string;
  deleteToken: string;
  expiresAt: string | null;
}

export interface UnlockedShare {
  id: string;
  manifest: ShareManifest;
  openFile(file: ManifestFile): ReadableStream<Uint8Array>;
}
