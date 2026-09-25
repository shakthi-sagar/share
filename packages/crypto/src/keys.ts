import { AES_KEY_BITS, KEY_INFO, MASTER_KEY_BYTES, ProtocolError } from "@share/protocol";
import { decodeBase64Url, encodeBase64Url, toArrayBuffer, utf8 } from "./encoding";

export interface ShareKeys {
  manifest: CryptoKey;
  readCredential: string;
}

export function generateMasterKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(MASTER_KEY_BYTES));
}

export function encodeMasterKey(masterKey: Uint8Array): string {
  assertMasterKey(masterKey);
  return encodeBase64Url(masterKey);
}

export function decodeMasterKey(encoded: string): Uint8Array {
  const key = decodeBase64Url(encoded);
  assertMasterKey(key);
  return key;
}

export async function deriveShareKeys(masterKey: Uint8Array, shareId: string): Promise<ShareKeys> {
  assertMasterKey(masterKey);
  const [manifestBytes, readBytes] = await Promise.all([
    deriveBits(masterKey, shareId, KEY_INFO.manifest),
    deriveBits(masterKey, shareId, KEY_INFO.readAuthorization),
  ]);

  return {
    manifest: await importAesKey(manifestBytes),
    readCredential: encodeBase64Url(readBytes),
  };
}

export async function deriveFileKey(
  masterKey: Uint8Array,
  shareId: string,
  objectId: string,
): Promise<CryptoKey> {
  assertMasterKey(masterKey);
  const bytes = await deriveBits(masterKey, shareId, `${KEY_INFO.filePrefix}${objectId}`);
  return importAesKey(bytes);
}

export async function hashCredential(credential: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(utf8(credential)));
  return encodeBase64Url(new Uint8Array(digest));
}

async function deriveBits(
  masterKey: Uint8Array,
  shareId: string,
  info: string,
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", toArrayBuffer(masterKey), "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(utf8(`share/v1/${shareId}`)),
      info: toArrayBuffer(utf8(info)),
    },
    material,
    AES_KEY_BITS,
  );
  return new Uint8Array(bits);
}

async function importAesKey(key: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toArrayBuffer(key), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function assertMasterKey(masterKey: Uint8Array): void {
  if (masterKey.byteLength !== MASTER_KEY_BYTES) {
    throw new ProtocolError("INVALID_MASTER_KEY", `Master key must be ${MASTER_KEY_BYTES} bytes`);
  }
}
