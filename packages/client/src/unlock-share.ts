import {
  decodeMasterKey,
  decryptChunk,
  decryptManifest,
  deriveFileKey,
  deriveShareKeys,
} from "@share/crypto";
import type { ManifestFile } from "@share/protocol";
import { apiUrl, requireOk } from "./http";
import type { UnlockedShare } from "./types";

export interface UnlockShareOptions {
  apiBaseUrl: string;
  id: string;
  key: string;
  fetch?: typeof globalThis.fetch;
}

export async function unlockEncryptedShare(options: UnlockShareOptions): Promise<UnlockedShare> {
  const request = options.fetch ?? globalThis.fetch;
  const masterKey = decodeMasterKey(options.key);
  const shareKeys = await deriveShareKeys(masterKey, options.id);
  const manifestResponse = await requireOk(
    await request(apiUrl(options.apiBaseUrl, `/v1/shares/${options.id}/manifest`), {
      headers: { Authorization: `Share ${shareKeys.readCredential}` },
    }),
  );
  const encryptedManifest = new Uint8Array(await manifestResponse.arrayBuffer());
  const manifest = await decryptManifest(encryptedManifest, shareKeys.manifest, options.id);

  return {
    id: options.id,
    manifest,
    openFile(file) {
      const listedFile = manifest.files.find((candidate) => candidate.id === file.id);
      if (!listedFile || listedFile.path !== file.path) {
        throw new Error("File is not part of this share");
      }
      return decryptedFileStream(
        request,
        options.apiBaseUrl,
        options.id,
        shareKeys.readCredential,
        masterKey,
        listedFile,
      );
    },
  };
}

function decryptedFileStream(
  request: typeof globalThis.fetch,
  apiBaseUrl: string,
  shareId: string,
  readCredential: string,
  masterKey: Uint8Array,
  file: ManifestFile,
): ReadableStream<Uint8Array> {
  let index = 0;
  let keyPromise: Promise<CryptoKey> | undefined;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= file.chunks) {
        controller.close();
        return;
      }

      keyPromise ??= deriveFileKey(masterKey, shareId, file.id);
      const response = await requireOk(
        await request(
          apiUrl(apiBaseUrl, `/v1/shares/${shareId}/objects/${file.id}/chunks/${index}`),
          { headers: { Authorization: `Share ${readCredential}` } },
        ),
      );
      const ciphertext = new Uint8Array(await response.arrayBuffer());
      const expectedBytes = expectedChunkBytes(file, index);
      const plaintext = await decryptChunk(ciphertext, expectedBytes, await keyPromise, {
        shareId,
        objectId: file.id,
        index,
        noncePrefix: file.noncePrefix,
      });
      index += 1;
      controller.enqueue(plaintext);
    },
  });
}

function expectedChunkBytes(file: ManifestFile, index: number): number {
  if (index < file.chunks - 1) {
    return file.chunkSize;
  }
  return file.size - file.chunkSize * (file.chunks - 1);
}
