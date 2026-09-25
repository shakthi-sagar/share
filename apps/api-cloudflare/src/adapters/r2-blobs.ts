import type { BlobStore, StoredBlob } from "@share/server";

export class R2BlobStore implements BlobStore {
  constructor(private readonly bucket: R2Bucket) {}

  async put(key: string, body: ArrayBuffer | ReadableStream<Uint8Array>): Promise<void> {
    await this.bucket.put(key, body, {
      httpMetadata: { contentType: "application/octet-stream" },
    });
  }

  async exists(key: string): Promise<boolean> {
    return (await this.bucket.head(key)) !== null;
  }

  async get(key: string): Promise<StoredBlob | null> {
    const object = await this.bucket.get(key);
    if (!object) {
      return null;
    }
    return { body: object.body, size: object.size, etag: object.httpEtag };
  }

  async removePrefix(prefix: string): Promise<void> {
    let cursor: string | undefined;
    do {
      const page = await this.bucket.list(cursor ? { prefix, cursor } : { prefix });
      if (page.objects.length > 0) {
        await this.bucket.delete(page.objects.map((object) => object.key));
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
}
