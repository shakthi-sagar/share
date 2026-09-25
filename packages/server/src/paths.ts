import { ProtocolError, shareIdSchema } from "@share/protocol";

const objectIdPattern = /^[A-Za-z0-9_-]{16,64}$/u;

export function sharePrefix(shareId: string): string {
  assertShareId(shareId);
  return `shares/${shareId}/`;
}

export function manifestObjectKey(shareId: string): string {
  return `${sharePrefix(shareId)}manifest`;
}

export function chunkObjectKey(shareId: string, objectId: string, index: number): string {
  assertShareId(shareId);
  if (!objectIdPattern.test(objectId)) {
    throw new ProtocolError("INVALID_OBJECT_ID", "Object id is invalid");
  }
  if (!Number.isInteger(index) || index < 0 || index > 0xffff_ffff) {
    throw new ProtocolError("INVALID_CHUNK_INDEX", "Chunk index is invalid");
  }
  return `${sharePrefix(shareId)}objects/${objectId}/${index.toString().padStart(10, "0")}`;
}

function assertShareId(shareId: string): void {
  if (!shareIdSchema.safeParse(shareId).success) {
    throw new ProtocolError("INVALID_SHARE_ID", "Share id is invalid");
  }
}
