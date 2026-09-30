import type {
  CompleteShareRequest,
  CreateShareRequest,
  CreateShareResponse,
} from "@share/protocol";
import { MAX_SHARE_CHUNKS, PROTOCOL_VERSION } from "@share/protocol";
import { ServiceError } from "./errors";
import { generateToken, hashSecret, secretMatchesHash } from "./secrets";
import type { MetadataStore, ShareRecord, UploadReservation } from "./types";

/**
 * How long a share may stay in the uploading state. Uploads are refused after it closes, and the
 * sweep deletes shares that never completed, so an abandoned upload cannot hold storage forever.
 */
export const UPLOAD_WINDOW_SECONDS = 24 * 60 * 60;

export async function createShare(
  store: MetadataStore,
  input: CreateShareRequest,
  now = new Date(),
): Promise<CreateShareResponse> {
  const id = generateToken(16);
  const uploadToken = generateToken();
  const deleteToken = generateToken();
  const expiresAt = input.expiresInSeconds
    ? new Date(now.getTime() + input.expiresInSeconds * 1000).toISOString()
    : null;

  await store.create({
    id,
    state: "uploading",
    formatVersion: PROTOCOL_VERSION,
    uploadTokenHash: await hashSecret(uploadToken),
    deleteTokenHash: await hashSecret(deleteToken),
    accessCredentialHash: null,
    objectCount: 0,
    chunkCount: 0,
    ciphertextBytes: 0,
    reservedBytes: 0,
    reservedChunks: 0,
    createdAt: now.toISOString(),
    completedAt: null,
    expiresAt,
  });

  return { version: PROTOCOL_VERSION, id, uploadToken, deleteToken, expiresAt };
}

/**
 * The token is checked before any lifecycle state, so a caller without it learns nothing about the
 * share, including whether it exists or has expired.
 */
export async function requireUploadAuthorization(
  store: MetadataStore,
  shareId: string,
  token: string | null,
  now = new Date(),
): Promise<ShareRecord> {
  const record = await requireRecord(store, shareId);
  if (!token || !(await secretMatchesHash(token, record.uploadTokenHash))) {
    throw notFound();
  }
  if (record.state !== "uploading") {
    throw notFound();
  }
  if (isExpired(record, now)) {
    throw new ServiceError(410, "SHARE_EXPIRED", "The share has expired");
  }
  if (Date.parse(record.createdAt) + UPLOAD_WINDOW_SECONDS * 1000 <= now.getTime()) {
    throw new ServiceError(410, "UPLOAD_WINDOW_CLOSED", "The upload window for this share closed");
  }
  return record;
}

/**
 * Counts an accepted upload body against the share's limits before it is stored. The check and the
 * increment happen in one store operation, so concurrent uploads cannot overshoot the limit.
 */
export async function reserveUpload(
  store: MetadataStore,
  shareId: string,
  reservation: UploadReservation,
  maxShareBytes: number,
): Promise<void> {
  const reserved = await store.reserve(shareId, reservation, {
    maxBytes: maxShareBytes,
    maxChunks: MAX_SHARE_CHUNKS,
  });
  if (!reserved) {
    throw new ServiceError(413, "SHARE_TOO_LARGE", "The share exceeds the size limit");
  }
}

export async function requireReadAuthorization(
  store: MetadataStore,
  shareId: string,
  credential: string | null,
  now = new Date(),
): Promise<ShareRecord> {
  const record = await requireRecord(store, shareId);
  if (
    isExpired(record, now) ||
    record.state !== "ready" ||
    !credential ||
    !record.accessCredentialHash
  ) {
    throw notFound();
  }
  if (!(await secretMatchesHash(credential, record.accessCredentialHash))) {
    throw notFound();
  }
  return record;
}

export async function requireDeleteAuthorization(
  store: MetadataStore,
  shareId: string,
  token: string | null,
): Promise<ShareRecord> {
  const record = await requireRecord(store, shareId);
  if (!token || !(await secretMatchesHash(token, record.deleteTokenHash))) {
    throw notFound();
  }
  return record;
}

/**
 * Marks an uploading share ready. The client reports its own totals; they cannot exceed what the
 * server accepted, so a client cannot record more storage than it was allowed to use.
 */
export async function completeShare(
  store: MetadataStore,
  shareId: string,
  completion: CompleteShareRequest,
  now = new Date(),
): Promise<void> {
  const record = await requireRecord(store, shareId);
  if (
    completion.chunkCount > record.reservedChunks ||
    completion.ciphertextBytes > record.reservedBytes
  ) {
    throw new ServiceError(
      409,
      "COMPLETION_MISMATCH",
      "The completion totals exceed the uploaded data",
    );
  }
  const completed = await store.complete(shareId, completion, now.toISOString());
  if (!completed) {
    throw new ServiceError(409, "SHARE_NOT_UPLOADABLE", "Share can no longer be completed");
  }
}

function isExpired(record: ShareRecord, now: Date): boolean {
  return record.expiresAt !== null && Date.parse(record.expiresAt) <= now.getTime();
}

async function requireRecord(store: MetadataStore, shareId: string): Promise<ShareRecord> {
  const record = await store.find(shareId);
  if (!record) {
    throw notFound();
  }
  return record;
}

function notFound(): ServiceError {
  return new ServiceError(404, "SHARE_NOT_FOUND", "Share not found");
}
