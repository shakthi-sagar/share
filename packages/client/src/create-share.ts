import {
  deriveFileKey,
  deriveShareKeys,
  encodeMasterKey,
  encryptChunk,
  encryptManifest,
  generateMasterKey,
  hashCredential,
  toArrayBuffer,
} from "@share/crypto";
import { createShareResponseSchema, DEFAULT_CHUNK_SIZE } from "@share/protocol";
import { apiUrl, requireOk } from "./http";
import { assertShareWithinLimits, measureManifest, planManifest } from "./limits";
import { fixedSizeChunks } from "./streams";
import type { CreatedShare, CreateShareOptions } from "./types";

export async function createEncryptedShare(options: CreateShareOptions): Promise<CreatedShare> {
  // Plan and measure everything before the first request, so a share that cannot be published
  // fails here instead of after its chunks were uploaded.
  const manifest = planManifest(options.name, options.files);
  const measurement = measureManifest(manifest);
  assertShareWithinLimits(measurement, options.maxShareBytes);

  const request = options.fetch ?? globalThis.fetch;
  const masterKey = options.masterKey ?? generateMasterKey();
  options.onProgress?.({ stage: "creating" });

  const creationResponse = await requireOk(
    await request(apiUrl(options.apiBaseUrl, "/v1/shares"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresInSeconds: options.expiresInSeconds }),
    }),
  );
  const created = createShareResponseSchema.parse(await creationResponse.json());
  const shareKeys = await deriveShareKeys(masterKey, created.id);
  let ciphertextBytes = 0;

  for (const [fileIndex, source] of options.files.entries()) {
    const planned = manifest.files[fileIndex];
    if (!planned) {
      throw new Error("The share plan does not match its files");
    }
    const fileKey = await deriveFileKey(masterKey, created.id, planned.id);
    let processedBytes = 0;
    let index = 0;

    for await (const plaintext of fixedSizeChunks(source.stream(), DEFAULT_CHUNK_SIZE)) {
      if (index >= planned.chunks) {
        throw new Error(`File changed while it was being read: ${source.path}`);
      }
      options.onProgress?.({
        stage: "encrypting",
        path: source.path,
        processedBytes,
        totalBytes: source.size,
      });
      const ciphertext = await encryptChunk(plaintext, fileKey, {
        shareId: created.id,
        objectId: planned.id,
        index,
        noncePrefix: planned.noncePrefix,
      });
      await requireOk(
        await request(
          apiUrl(
            options.apiBaseUrl,
            `/v1/shares/${created.id}/objects/${planned.id}/chunks/${index}`,
          ),
          {
            method: "PUT",
            headers: { Authorization: `Upload ${created.uploadToken}` },
            body: toArrayBuffer(ciphertext),
          },
        ),
      );
      processedBytes += plaintext.byteLength;
      ciphertextBytes += ciphertext.byteLength;
      index += 1;
      options.onProgress?.({
        stage: "uploading",
        path: source.path,
        uploadedChunks: index,
        totalChunks: planned.chunks,
      });
    }

    if (processedBytes !== source.size || index !== planned.chunks) {
      throw new Error(`File changed while it was being read: ${source.path}`);
    }
  }

  const encryptedManifest = await encryptManifest(manifest, shareKeys.manifest, created.id);
  ciphertextBytes += encryptedManifest.byteLength;
  await requireOk(
    await request(apiUrl(options.apiBaseUrl, `/v1/shares/${created.id}/manifest`), {
      method: "PUT",
      headers: { Authorization: `Upload ${created.uploadToken}` },
      body: toArrayBuffer(encryptedManifest),
    }),
  );

  options.onProgress?.({ stage: "finalizing" });
  await requireOk(
    await request(apiUrl(options.apiBaseUrl, `/v1/shares/${created.id}/complete`), {
      method: "POST",
      headers: {
        Authorization: `Upload ${created.uploadToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessCredentialHash: await hashCredential(shareKeys.readCredential),
        objectCount: manifest.files.length,
        chunkCount: measurement.chunkCount,
        ciphertextBytes,
      }),
    }),
  );
  options.onProgress?.({ stage: "complete" });

  const key = encodeMasterKey(masterKey);
  const url = `${options.shareBaseUrl.replace(/\/$/u, "")}/s/${created.id}`;
  return {
    id: created.id,
    key,
    url,
    urlWithKey: `${url}#k=${key}`,
    deleteToken: created.deleteToken,
    expiresAt: created.expiresAt,
  };
}
