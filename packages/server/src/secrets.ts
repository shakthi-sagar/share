import { decodeBase64Url, encodeBase64Url, hashCredential } from "@share/crypto";

export function generateToken(byteLength = 32): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function hashSecret(secret: string): Promise<string> {
  return hashCredential(secret);
}

export async function secretMatchesHash(secret: string, expectedHash: string): Promise<boolean> {
  const actualHash = await hashSecret(secret);

  try {
    return constantTimeEqual(decodeBase64Url(actualHash), decodeBase64Url(expectedHash));
  } catch {
    return false;
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const maximumLength = Math.max(left.byteLength, right.byteLength);
  let difference = left.byteLength ^ right.byteLength;

  for (let index = 0; index < maximumLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}
