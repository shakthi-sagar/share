import { hashCredential } from "@share/crypto";
import { MAX_SHARE_CHUNKS } from "@share/protocol";
import { describe, expect, it } from "vitest";
import {
  completeShare,
  createShare,
  requireDeleteAuthorization,
  requireReadAuthorization,
  requireUploadAuthorization,
  reserveUpload,
  ServiceError,
  UPLOAD_WINDOW_SECONDS,
} from "../src";
import { MemoryMetadataStore } from "../src/testing";

const created = new Date("2026-09-25T00:00:00.000Z");
const later = (seconds: number): Date => new Date(created.getTime() + seconds * 1000);
const limit = 1024;

describe("share lifecycle", () => {
  it("separates upload, read, and delete authority", async () => {
    const store = new MemoryMetadataStore();
    const share = await createShare(store, { expiresInSeconds: 3600 });
    const readCredential = "a".repeat(43);

    await expect(
      requireUploadAuthorization(store, share.id, share.uploadToken),
    ).resolves.toMatchObject({ state: "uploading" });
    await expect(requireReadAuthorization(store, share.id, readCredential)).rejects.toBeInstanceOf(
      ServiceError,
    );

    await reserveUpload(store, share.id, { bytes: 100, chunks: 3 }, limit);
    await completeShare(store, share.id, {
      accessCredentialHash: await hashCredential(readCredential),
      objectCount: 2,
      chunkCount: 3,
      ciphertextBytes: 100,
    });

    await expect(requireReadAuthorization(store, share.id, readCredential)).resolves.toMatchObject({
      state: "ready",
    });
    await expect(requireReadAuthorization(store, share.id, "b".repeat(43))).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      requireUploadAuthorization(store, share.id, share.uploadToken),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      requireDeleteAuthorization(store, share.id, share.deleteToken),
    ).resolves.toMatchObject({ id: share.id });
  });

  it("tells only the token holder that an upload expired", async () => {
    const store = new MemoryMetadataStore();
    const share = await createShare(store, { expiresInSeconds: 60 }, created);

    await expect(
      requireUploadAuthorization(store, share.id, share.uploadToken, later(61)),
    ).rejects.toMatchObject({ status: 410, code: "SHARE_EXPIRED" });

    for (const token of [null, "wrong-token", share.deleteToken]) {
      await expect(
        requireUploadAuthorization(store, share.id, token, later(61)),
      ).rejects.toMatchObject({ status: 404, code: "SHARE_NOT_FOUND" });
    }
    await expect(
      requireUploadAuthorization(store, "AAAAAAAAAAAAAAAAAAAAAA", share.uploadToken, later(61)),
    ).rejects.toMatchObject({ status: 404, code: "SHARE_NOT_FOUND" });
  });

  it("closes the upload window for shares that never expire", async () => {
    const store = new MemoryMetadataStore();
    const share = await createShare(store, { expiresInSeconds: null }, created);

    await expect(
      requireUploadAuthorization(
        store,
        share.id,
        share.uploadToken,
        later(UPLOAD_WINDOW_SECONDS - 1),
      ),
    ).resolves.toMatchObject({ state: "uploading" });
    await expect(
      requireUploadAuthorization(store, share.id, share.uploadToken, later(UPLOAD_WINDOW_SECONDS)),
    ).rejects.toMatchObject({ status: 410, code: "UPLOAD_WINDOW_CLOSED" });
  });

  it("refuses uploads beyond the share byte limit without changing the totals", async () => {
    const store = new MemoryMetadataStore();
    const share = await createShare(store, { expiresInSeconds: 60 });

    await reserveUpload(store, share.id, { bytes: limit - 10, chunks: 1 }, limit);
    await expect(
      reserveUpload(store, share.id, { bytes: 11, chunks: 1 }, limit),
    ).rejects.toMatchObject({ status: 413, code: "SHARE_TOO_LARGE" });
    await reserveUpload(store, share.id, { bytes: 10, chunks: 1 }, limit);

    expect(store.records.get(share.id)).toMatchObject({ reservedBytes: limit, reservedChunks: 2 });
  });

  it("refuses uploads beyond the chunk limit", async () => {
    const store = new MemoryMetadataStore();
    const share = await createShare(store, { expiresInSeconds: 60 });
    const record = store.records.get(share.id);
    if (!record) throw new Error("missing record");
    record.reservedChunks = MAX_SHARE_CHUNKS;

    await expect(
      reserveUpload(store, share.id, { bytes: 1, chunks: 1 }, limit),
    ).rejects.toMatchObject({ status: 413 });
    await reserveUpload(store, share.id, { bytes: 1, chunks: 0 }, limit);
  });

  it("refuses completion totals larger than the uploaded data", async () => {
    const store = new MemoryMetadataStore();
    const share = await createShare(store, { expiresInSeconds: 60 });
    await reserveUpload(store, share.id, { bytes: 50, chunks: 1 }, limit);
    const completion = {
      accessCredentialHash: await hashCredential("a".repeat(43)),
      objectCount: 1,
      chunkCount: 1,
      ciphertextBytes: 50,
    };

    await expect(
      completeShare(store, share.id, { ...completion, ciphertextBytes: 51 }),
    ).rejects.toMatchObject({ status: 409, code: "COMPLETION_MISMATCH" });
    await expect(
      completeShare(store, share.id, { ...completion, chunkCount: 2 }),
    ).rejects.toMatchObject({ status: 409, code: "COMPLETION_MISMATCH" });

    await completeShare(store, share.id, completion);
    await expect(completeShare(store, share.id, completion)).rejects.toMatchObject({
      status: 409,
      code: "SHARE_NOT_UPLOADABLE",
    });
    await expect(
      reserveUpload(store, share.id, { bytes: 1, chunks: 1 }, limit),
    ).rejects.toMatchObject({ status: 413 });
  });
});
