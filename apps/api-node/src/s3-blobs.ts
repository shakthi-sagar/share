import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import type { BlobStore, StoredBlob } from "@share/server";

export class S3BlobStore implements BlobStore {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async put(key: string, body: ArrayBuffer | ReadableStream<Uint8Array>): Promise<void> {
    if (!(body instanceof ArrayBuffer)) throw new Error("Expected a bounded encrypted object");
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: new Uint8Array(body),
        ContentLength: body.byteLength,
        ContentType: "application/octet-stream",
      }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (missing(error)) return false;
      throw error;
    }
  }

  async get(key: string): Promise<StoredBlob | null> {
    try {
      const object = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!object.Body || object.ContentLength === undefined) {
        throw new Error("S3 returned an incomplete response");
      }
      return {
        body: object.Body.transformToWebStream(),
        size: object.ContentLength,
        etag: object.ETag ?? "",
      };
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  async removePrefix(prefix: string): Promise<void> {
    for (;;) {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: 1000,
        }),
      );
      const objects = (page.Contents ?? []).flatMap((object) =>
        object.Key ? [{ Key: object.Key }] : [],
      );
      if (!objects.length) return;
      const result = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: objects, Quiet: true },
        }),
      );
      if (result.Errors?.length) throw new Error("S3 could not delete all encrypted objects");
      if (!page.IsTruncated) return;
    }
  }
}

function missing(error: unknown): boolean {
  return error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404;
}
