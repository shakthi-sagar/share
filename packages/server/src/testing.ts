/**
 * In-memory store implementations for tests of the server rules and of adapters built on them.
 * Not for production use: nothing here persists.
 */
import type { CompleteShareRequest } from "@share/protocol";
import type {
  BlobStore,
  MetadataStore,
  ShareRecord,
  StoredBlob,
  UploadLimits,
  UploadReservation,
} from "./types";

/** Shared call log so tests can assert cross-store ordering. */
export type CallLog = string[];

export class MemoryMetadataStore implements MetadataStore {
  readonly records = new Map<string, ShareRecord>();

  constructor(private readonly calls?: CallLog) {}

  async create(record: ShareRecord): Promise<void> {
    this.records.set(record.id, structuredClone(record));
  }

  async find(id: string): Promise<ShareRecord | null> {
    const record = this.records.get(id);
    return record ? structuredClone(record) : null;
  }

  async complete(
    id: string,
    completion: CompleteShareRequest,
    completedAt: string,
  ): Promise<boolean> {
    const record = this.records.get(id);
    if (record?.state !== "uploading") {
      return false;
    }
    this.records.set(id, { ...record, ...completion, state: "ready", completedAt });
    return true;
  }

  async reserve(
    id: string,
    reservation: UploadReservation,
    limits: UploadLimits,
  ): Promise<boolean> {
    const record = this.records.get(id);
    if (
      record?.state !== "uploading" ||
      record.reservedBytes + reservation.bytes > limits.maxBytes ||
      record.reservedChunks + reservation.chunks > limits.maxChunks
    ) {
      return false;
    }
    record.reservedBytes += reservation.bytes;
    record.reservedChunks += reservation.chunks;
    return true;
  }

  async remove(id: string): Promise<boolean> {
    this.calls?.push(`metadata:remove:${id}`);
    return this.records.delete(id);
  }

  async listPurgeable(
    expiredAt: string,
    abandonedBefore: string,
    limit: number,
  ): Promise<string[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          (record.expiresAt !== null && record.expiresAt <= expiredAt) ||
          (record.state === "uploading" && record.createdAt <= abandonedBefore),
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(0, limit)
      .map((record) => record.id);
  }
}

export class MemoryBlobStore implements BlobStore {
  readonly objects = new Map<string, Uint8Array>();

  /** Prefixes that must fail, used to exercise partial failures. */
  readonly failingPrefixes = new Set<string>();

  constructor(private readonly calls?: CallLog) {}

  async put(key: string, body: ArrayBuffer | ReadableStream<Uint8Array>): Promise<void> {
    this.objects.set(key, new Uint8Array(await new Response(body).arrayBuffer()));
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  async get(key: string): Promise<StoredBlob | null> {
    const value = this.objects.get(key);
    if (!value) {
      return null;
    }
    const body = value;
    return {
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        },
      }),
      size: body.byteLength,
      etag: `"${key}"`,
    };
  }

  async removePrefix(prefix: string): Promise<void> {
    this.calls?.push(`blobs:removePrefix:${prefix}`);
    if (this.failingPrefixes.has(prefix)) {
      throw new Error(`Storage is unavailable for ${prefix}`);
    }
    for (const key of [...this.objects.keys()]) {
      if (key.startsWith(prefix)) {
        this.objects.delete(key);
      }
    }
  }
}
