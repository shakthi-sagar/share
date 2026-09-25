import type {
  CompleteShareRequest,
  CreateShareRequest,
  CreateShareResponse,
} from "@share/protocol";
import { PROTOCOL_VERSION } from "@share/protocol";
import { ServiceError } from "./errors";
import { generateToken, hashSecret, secretMatchesHash } from "./secrets";
import type { MetadataStore, ShareRecord } from "./types";

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
    createdAt: now.toISOString(),
    completedAt: null,
    expiresAt,
  });

  return { version: PROTOCOL_VERSION, id, uploadToken, deleteToken, expiresAt };
}

export async function requireUploadAuthorization(
  store: MetadataStore,
  shareId: string,
  token: string | null,
  now = new Date(),
): Promise<ShareRecord> {
  const record = await requireRecord(store, shareId);
  if (isExpired(record, now)) {
    throw new ServiceError(410, "SHARE_EXPIRED", "The share has expired");
  }
  if (record.state !== "uploading" || !token) {
    throw new ServiceError(404, "SHARE_NOT_FOUND", "Share not found");
  }
  if (!(await secretMatchesHash(token, record.uploadTokenHash))) {
    throw new ServiceError(404, "SHARE_NOT_FOUND", "Share not found");
  }
  return record;
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
    throw new ServiceError(404, "SHARE_NOT_FOUND", "Share not found");
  }
  if (!(await secretMatchesHash(credential, record.accessCredentialHash))) {
    throw new ServiceError(404, "SHARE_NOT_FOUND", "Share not found");
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
    throw new ServiceError(404, "SHARE_NOT_FOUND", "Share not found");
  }
  return record;
}

export async function completeShare(
  store: MetadataStore,
  shareId: string,
  completion: CompleteShareRequest,
  now = new Date(),
): Promise<void> {
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
    throw new ServiceError(404, "SHARE_NOT_FOUND", "Share not found");
  }
  return record;
}
