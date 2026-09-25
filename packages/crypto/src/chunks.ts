import { FILE_NONCE_PREFIX_BYTES, ProtocolError } from "@share/protocol";
import { decodeBase64Url, encodeBase64Url, toArrayBuffer, utf8 } from "./encoding";

export function generateFileNoncePrefix(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(FILE_NONCE_PREFIX_BYTES)));
}

export async function encryptChunk(
  plaintext: Uint8Array,
  key: CryptoKey,
  context: ChunkContext,
): Promise<Uint8Array> {
  assertChunkIndex(context.index);
  const result = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(chunkIv(context.noncePrefix, context.index)),
      additionalData: toArrayBuffer(chunkAad(context, plaintext.byteLength)),
    },
    key,
    toArrayBuffer(plaintext),
  );
  return new Uint8Array(result);
}

export async function decryptChunk(
  ciphertext: Uint8Array,
  expectedPlaintextBytes: number,
  key: CryptoKey,
  context: ChunkContext,
): Promise<Uint8Array> {
  assertChunkIndex(context.index);
  try {
    const result = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(chunkIv(context.noncePrefix, context.index)),
        additionalData: toArrayBuffer(chunkAad(context, expectedPlaintextBytes)),
      },
      key,
      toArrayBuffer(ciphertext),
    );
    const plaintext = new Uint8Array(result);
    if (plaintext.byteLength !== expectedPlaintextBytes) {
      throw new ProtocolError("INVALID_CHUNK_LENGTH", "Decrypted chunk has an unexpected length");
    }
    return plaintext;
  } catch (error) {
    if (error instanceof ProtocolError) {
      throw error;
    }
    throw new ProtocolError(
      "CHUNK_DECRYPTION_FAILED",
      "The file chunk could not be authenticated",
      {
        cause: error,
      },
    );
  }
}

export interface ChunkContext {
  shareId: string;
  objectId: string;
  index: number;
  noncePrefix: string;
}

function chunkIv(encodedPrefix: string, index: number): Uint8Array {
  const prefix = decodeBase64Url(encodedPrefix);
  if (prefix.byteLength !== FILE_NONCE_PREFIX_BYTES) {
    throw new ProtocolError(
      "INVALID_NONCE_PREFIX",
      `File nonce prefix must be ${FILE_NONCE_PREFIX_BYTES} bytes`,
    );
  }

  const iv = new Uint8Array(12);
  iv.set(prefix, 0);
  new DataView(iv.buffer).setUint32(FILE_NONCE_PREFIX_BYTES, index, false);
  return iv;
}

function chunkAad(context: ChunkContext, plaintextBytes: number): Uint8Array {
  return utf8(
    `share/v1/chunk/${context.shareId}/${context.objectId}/${context.index}/${plaintextBytes}`,
  );
}

function assertChunkIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index > 0xffff_ffff) {
    throw new ProtocolError("INVALID_CHUNK_INDEX", "Chunk index is out of range");
  }
}
