import { hashCredential } from "@share/crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { completeShare, createShare, deleteShare, purgeExpiredShares, sharePrefix } from "../src";
import { type CallLog, MemoryBlobStore, MemoryMetadataStore } from "./memory-stores";

const published = new Date("2026-09-25T00:00:00.000Z");
const afterExpiry = new Date("2026-09-25T00:02:00.000Z");

describe("share storage lifecycle", () => {
  let metadata: MemoryMetadataStore;
  let blobs: MemoryBlobStore;
  let calls: CallLog;

  beforeEach(() => {
    calls = [];
    metadata = new MemoryMetadataStore(calls);
    blobs = new MemoryBlobStore(calls);
  });

  /** Creates a ready share with one stored object and returns its generated id. */
  async function publish(expiresInSeconds: number | null): Promise<string> {
    const created = await createShare(metadata, { expiresInSeconds }, published);
    await completeShare(metadata, created.id, {
      accessCredentialHash: await hashCredential("a".repeat(43)),
      objectCount: 1,
      chunkCount: 1,
      ciphertextBytes: 12,
    });
    await blobs.put(`${sharePrefix(created.id)}manifest`, new ArrayBuffer(12));
    return created.id;
  }

  it("removes ciphertext and metadata for expired shares only", async () => {
    const expired = await publish(60);
    const live = await publish(3600);
    const withoutExpiry = await publish(null);

    const result = await purgeExpiredShares(metadata, blobs, afterExpiry);

    expect(result).toEqual({ scanned: 1, removed: 1, failed: 0, truncated: false });
    expect(calls).toEqual([
      `blobs:removePrefix:${sharePrefix(expired)}`,
      `metadata:remove:${expired}`,
    ]);
    expect([...blobs.objects.keys()]).toEqual([
      `${sharePrefix(live)}manifest`,
      `${sharePrefix(withoutExpiry)}manifest`,
    ]);
    expect([...metadata.records.keys()].sort()).toEqual([live, withoutExpiry].sort());
  });

  it("keeps the record when objects cannot be removed so the next sweep retries", async () => {
    const id = await publish(60);
    blobs.failingPrefixes.add(sharePrefix(id));
    const failures: string[] = [];

    const failed = await purgeExpiredShares(metadata, blobs, afterExpiry, {
      onError: (shareId) => failures.push(shareId),
    });

    expect(failed).toEqual({ scanned: 1, removed: 0, failed: 1, truncated: false });
    expect(failures).toEqual([id]);
    expect(calls).toEqual([`blobs:removePrefix:${sharePrefix(id)}`]);
    expect(metadata.records.has(id)).toBe(true);

    blobs.failingPrefixes.clear();
    const retried = await purgeExpiredShares(metadata, blobs, afterExpiry);
    expect(retried.removed).toBe(1);
    expect(metadata.records.size).toBe(0);
    expect(blobs.objects.size).toBe(0);
  });

  it("drains a backlog in batches and stops at the sweep limit", async () => {
    const first = await publish(60);
    const second = await publish(60);

    const partial = await purgeExpiredShares(metadata, blobs, afterExpiry, {
      batchSize: 1,
      limit: 1,
    });
    expect(partial).toEqual({ scanned: 1, removed: 1, failed: 0, truncated: true });
    expect(metadata.records.size).toBe(1);

    const rest = await purgeExpiredShares(metadata, blobs, afterExpiry, { batchSize: 1 });
    expect(rest).toEqual({ scanned: 1, removed: 1, failed: 0, truncated: false });
    expect(metadata.records.size).toBe(0);
    expect(blobs.objects.size).toBe(0);
    expect([first, second]).toHaveLength(2);
  });

  it("does nothing when a sweep is not allowed to run", async () => {
    await publish(60);
    const result = await purgeExpiredShares(metadata, blobs, afterExpiry, { limit: 0 });
    expect(result).toEqual({ scanned: 0, removed: 0, failed: 0, truncated: false });
    expect(metadata.records.size).toBe(1);
    expect(blobs.objects.size).toBe(1);
  });

  it("deletes a share only with its delete token, and objects before metadata", async () => {
    const created = await createShare(metadata, { expiresInSeconds: 3600 }, published);
    await blobs.put(`${sharePrefix(created.id)}manifest`, new ArrayBuffer(4));

    await expect(deleteShare(metadata, blobs, created.id, "wrong-token")).rejects.toMatchObject({
      status: 404,
    });
    expect(blobs.objects.size).toBe(1);
    expect(metadata.records.size).toBe(1);

    await deleteShare(metadata, blobs, created.id, created.deleteToken);

    expect(calls).toEqual([
      `blobs:removePrefix:${sharePrefix(created.id)}`,
      `metadata:remove:${created.id}`,
    ]);
    expect(blobs.objects.size).toBe(0);
    expect(metadata.records.size).toBe(0);
  });

  it("keeps accepting deletion after expiry", async () => {
    const created = await createShare(metadata, { expiresInSeconds: 60 }, published);
    await deleteShare(metadata, blobs, created.id, created.deleteToken);
    expect(metadata.records.size).toBe(0);
  });
});
