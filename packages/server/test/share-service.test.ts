import { hashCredential } from "@share/crypto";
import { describe, expect, it } from "vitest";
import {
  completeShare,
  createShare,
  requireDeleteAuthorization,
  requireReadAuthorization,
  requireUploadAuthorization,
  ServiceError,
} from "../src";
import { MemoryMetadataStore } from "./memory-stores";

describe("share lifecycle", () => {
  it("separates upload, read, and delete authority", async () => {
    const store = new MemoryMetadataStore();
    const created = await createShare(store, { expiresInSeconds: 3600 });
    const readCredential = "a".repeat(43);

    await expect(
      requireUploadAuthorization(store, created.id, created.uploadToken),
    ).resolves.toMatchObject({ state: "uploading" });
    await expect(
      requireReadAuthorization(store, created.id, readCredential),
    ).rejects.toBeInstanceOf(ServiceError);

    await completeShare(store, created.id, {
      accessCredentialHash: await hashCredential(readCredential),
      objectCount: 2,
      chunkCount: 3,
      ciphertextBytes: 100,
    });

    await expect(
      requireReadAuthorization(store, created.id, readCredential),
    ).resolves.toMatchObject({
      state: "ready",
    });
    await expect(requireReadAuthorization(store, created.id, "b".repeat(43))).rejects.toMatchObject(
      {
        status: 404,
      },
    );
    await expect(
      requireDeleteAuthorization(store, created.id, created.deleteToken),
    ).resolves.toMatchObject({ id: created.id });
  });

  it("refuses access after expiry", async () => {
    const store = new MemoryMetadataStore();
    const now = new Date("2026-09-25T00:00:00.000Z");
    const created = await createShare(store, { expiresInSeconds: 60 }, now);

    await expect(
      requireUploadAuthorization(
        store,
        created.id,
        created.uploadToken,
        new Date("2026-09-25T00:01:01.000Z"),
      ),
    ).rejects.toMatchObject({ status: 410, code: "SHARE_EXPIRED" });
  });
});
