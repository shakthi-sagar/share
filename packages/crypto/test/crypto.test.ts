import type { ShareManifest } from "@share/protocol";
import { describe, expect, it } from "vitest";
import {
  decodeMasterKey,
  decryptChunk,
  decryptManifest,
  deriveFileKey,
  deriveShareKeys,
  encodeMasterKey,
  encryptChunk,
  encryptManifest,
  generateFileNoncePrefix,
  generateMasterKey,
  hashCredential,
} from "../src";

const shareId = "AbCdEfGhIjKlMnOpQrStUv";
const objectId = "FileObject_123456";

describe("share crypto", () => {
  it("round trips a master key", () => {
    const generated = generateMasterKey();
    expect(decodeMasterKey(encodeMasterKey(generated))).toEqual(generated);
  });

  it("derives stable, separated keys", async () => {
    const masterKey = new Uint8Array(32).fill(7);
    const first = await deriveShareKeys(masterKey, shareId);
    const second = await deriveShareKeys(masterKey, shareId);

    expect(first.readCredential).toBe(second.readCredential);
    expect(await hashCredential(first.readCredential)).toHaveLength(43);

    expect(first.readCredential).not.toBe(encodeMasterKey(masterKey));
  });

  it("encrypts and authenticates the manifest", async () => {
    const masterKey = new Uint8Array(32).fill(11);
    const { manifest: manifestKey } = await deriveShareKeys(masterKey, shareId);
    const manifest: ShareManifest = {
      version: 1,
      name: "Project docs",
      files: [
        {
          id: objectId,
          path: "docs/architecture.md",
          mime: "text/markdown",
          size: 5,
          chunkSize: 4 * 1024 * 1024,
          chunks: 1,
          noncePrefix: generateFileNoncePrefix(),
        },
      ],
    };

    const encrypted = await encryptManifest(manifest, manifestKey, shareId);
    expect(await decryptManifest(encrypted, manifestKey, shareId)).toEqual(manifest);

    const tampered = encrypted.slice();
    const lastIndex = tampered.length - 1;
    tampered[lastIndex] = (tampered[lastIndex] ?? 0) ^ 1;
    await expect(decryptManifest(tampered, manifestKey, shareId)).rejects.toMatchObject({
      code: "MANIFEST_DECRYPTION_FAILED",
    });
  });

  it("encrypts chunks with context-bound authentication", async () => {
    const masterKey = new Uint8Array(32).fill(13);
    const key = await deriveFileKey(masterKey, shareId, objectId);
    const plaintext = new TextEncoder().encode("hello encrypted world");
    const context = {
      shareId,
      objectId,
      index: 0,
      noncePrefix: generateFileNoncePrefix(),
    };

    const encrypted = await encryptChunk(plaintext, key, context);
    expect(await decryptChunk(encrypted, plaintext.byteLength, key, context)).toEqual(plaintext);
    await expect(
      decryptChunk(encrypted, plaintext.byteLength, key, { ...context, index: 1 }),
    ).rejects.toMatchObject({ code: "CHUNK_DECRYPTION_FAILED" });
  });
});
