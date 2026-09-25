import {
  GCM_IV_BYTES,
  ProtocolError,
  type ShareManifest,
  shareManifestSchema,
} from "@share/protocol";
import { decodeUtf8, toArrayBuffer, utf8 } from "./encoding";

export async function encryptManifest(
  manifest: ShareManifest,
  key: CryptoKey,
  shareId: string,
): Promise<Uint8Array> {
  const validated = shareManifestSchema.parse(manifest);
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(manifestAad(shareId)),
    },
    key,
    toArrayBuffer(utf8(JSON.stringify(validated))),
  );

  const envelope = new Uint8Array(GCM_IV_BYTES + ciphertext.byteLength);
  envelope.set(iv, 0);
  envelope.set(new Uint8Array(ciphertext), GCM_IV_BYTES);
  return envelope;
}

export async function decryptManifest(
  envelope: Uint8Array,
  key: CryptoKey,
  shareId: string,
): Promise<ShareManifest> {
  if (envelope.byteLength <= GCM_IV_BYTES) {
    throw new ProtocolError("INVALID_MANIFEST", "Encrypted manifest is truncated");
  }

  const iv = envelope.slice(0, GCM_IV_BYTES);
  const ciphertext = envelope.slice(GCM_IV_BYTES);

  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(manifestAad(shareId)),
      },
      key,
      toArrayBuffer(ciphertext),
    );
    return shareManifestSchema.parse(JSON.parse(decodeUtf8(plaintext)));
  } catch (error) {
    throw new ProtocolError(
      "MANIFEST_DECRYPTION_FAILED",
      "The encrypted manifest could not be authenticated",
      { cause: error },
    );
  }
}

function manifestAad(shareId: string): Uint8Array {
  return utf8(`share/v1/manifest/${shareId}`);
}
