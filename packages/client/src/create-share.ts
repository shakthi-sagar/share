import {
  deriveFileKey,
  deriveShareKeys,
  encodeBase64Url,
  encodeMasterKey,
  encryptChunk,
  encryptManifest,
  generateFileNoncePrefix,
  generateMasterKey,
  hashCredential,
  toArrayBuffer,
} from "@share/crypto";
import {
  createShareResponseSchema,
  DEFAULT_CHUNK_SIZE,
  isSafeRelativePath,
  type ManifestFile,
  PROTOCOL_VERSION,
  type ShareManifest,
} from "@share/protocol";
import { apiUrl, requireOk } from "./http";
import { fixedSizeChunks } from "./streams";
import type { CreatedShare, CreateShareOptions } from "./types";

export async function createEncryptedShare(options: CreateShareOptions): Promise<CreatedShare> {
  validateSources(options.files);
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
  const manifestFiles: ManifestFile[] = [];
  let chunkCount = 0;
  let ciphertextBytes = 0;

  for (const source of options.files) {
    const objectId = encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)));
    const noncePrefix = generateFileNoncePrefix();
    const totalChunks = Math.ceil(source.size / DEFAULT_CHUNK_SIZE);
    const fileKey = await deriveFileKey(masterKey, created.id, objectId);
    let processedBytes = 0;
    let index = 0;

    for await (const plaintext of fixedSizeChunks(source.stream(), DEFAULT_CHUNK_SIZE)) {
      options.onProgress?.({
        stage: "encrypting",
        path: source.path,
        processedBytes,
        totalBytes: source.size,
      });
      const ciphertext = await encryptChunk(plaintext, fileKey, {
        shareId: created.id,
        objectId,
        index,
        noncePrefix,
      });
      await requireOk(
        await request(
          apiUrl(
            options.apiBaseUrl,
            `/v1/shares/${created.id}/objects/${objectId}/chunks/${index}`,
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
      chunkCount += 1;
      options.onProgress?.({
        stage: "uploading",
        path: source.path,
        uploadedChunks: index,
        totalChunks,
      });
    }

    if (processedBytes !== source.size || index !== totalChunks) {
      throw new Error(`File changed while it was being read: ${source.path}`);
    }

    manifestFiles.push({
      id: objectId,
      path: source.path,
      mime: source.mime || "application/octet-stream",
      size: source.size,
      chunkSize: DEFAULT_CHUNK_SIZE,
      chunks: totalChunks,
      noncePrefix,
    });
  }

  const manifest: ShareManifest = {
    version: PROTOCOL_VERSION,
    name: options.name,
    files: manifestFiles,
  };
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
        objectCount: manifestFiles.length,
        chunkCount,
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

function validateSources(files: CreateShareOptions["files"]): void {
  if (files.length === 0) {
    throw new Error("At least one file is required");
  }
  const paths = new Set<string>();
  for (const file of files) {
    if (!isSafeRelativePath(file.path)) {
      throw new Error(`Unsafe file path: ${file.path}`);
    }
    if (!Number.isSafeInteger(file.size) || file.size < 0) {
      throw new Error(`Invalid file size: ${file.path}`);
    }
    if (paths.has(file.path)) {
      throw new Error(`Duplicate file path: ${file.path}`);
    }
    paths.add(file.path);
  }
}
