import {
  completeShareRequestSchema,
  createShareRequestSchema,
  MAX_CHUNK_CIPHERTEXT_BYTES,
  MAX_MANIFEST_CIPHERTEXT_BYTES,
} from "@share/protocol";
import {
  chunkObjectKey,
  completeShare,
  createShare,
  manifestObjectKey,
  requireDeleteAuthorization,
  requireReadAuthorization,
  requireUploadAuthorization,
  ServiceError,
  sharePrefix,
} from "@share/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { D1MetadataStore } from "./adapters/d1-metadata";
import { R2BlobStore } from "./adapters/r2-blobs";

type Bindings = { Bindings: Env };
const app = new Hono<Bindings>();

app.use("*", secureHeaders());
app.use(
  "/v1/*",
  cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400,
  }),
);

app.get("/health", (context) => context.json({ status: "ok" }));

app.post("/v1/shares", async (context) => {
  const input = createShareRequestSchema.parse(await context.req.json());
  const result = await createShare(new D1MetadataStore(context.env.DB), input);
  return context.json(result, 201);
});

app.put("/v1/shares/:id/manifest", async (context) => {
  const shareId = context.req.param("id");
  const metadata = new D1MetadataStore(context.env.DB);
  await requireUploadAuthorization(metadata, shareId, authorization(context.req.raw, "Upload"));
  const body = await boundedBody(context.req.raw, MAX_MANIFEST_CIPHERTEXT_BYTES);
  await new R2BlobStore(context.env.BLOBS).put(manifestObjectKey(shareId), body);
  return context.body(null, 204);
});

app.put("/v1/shares/:id/objects/:objectId/chunks/:index", async (context) => {
  const shareId = context.req.param("id");
  const metadata = new D1MetadataStore(context.env.DB);
  await requireUploadAuthorization(metadata, shareId, authorization(context.req.raw, "Upload"));
  const key = chunkObjectKey(
    shareId,
    context.req.param("objectId"),
    parseChunkIndex(context.req.param("index")),
  );
  const body = await boundedBody(context.req.raw, MAX_CHUNK_CIPHERTEXT_BYTES);
  await new R2BlobStore(context.env.BLOBS).put(key, body);
  return context.body(null, 204);
});

app.post("/v1/shares/:id/complete", async (context) => {
  const shareId = context.req.param("id");
  const metadata = new D1MetadataStore(context.env.DB);
  await requireUploadAuthorization(metadata, shareId, authorization(context.req.raw, "Upload"));
  const blobs = new R2BlobStore(context.env.BLOBS);
  if (!(await blobs.exists(manifestObjectKey(shareId)))) {
    throw new ServiceError(409, "MANIFEST_MISSING", "Upload the encrypted manifest first");
  }
  const completion = completeShareRequestSchema.parse(await context.req.json());
  await completeShare(metadata, shareId, completion);
  return context.body(null, 204);
});

app.get("/v1/shares/:id/manifest", async (context) => {
  const shareId = context.req.param("id");
  await requireReadAuthorization(
    new D1MetadataStore(context.env.DB),
    shareId,
    authorization(context.req.raw, "Share"),
  );
  return blobResponse(await new R2BlobStore(context.env.BLOBS).get(manifestObjectKey(shareId)));
});

app.get("/v1/shares/:id/objects/:objectId/chunks/:index", async (context) => {
  const shareId = context.req.param("id");
  await requireReadAuthorization(
    new D1MetadataStore(context.env.DB),
    shareId,
    authorization(context.req.raw, "Share"),
  );
  const key = chunkObjectKey(
    shareId,
    context.req.param("objectId"),
    parseChunkIndex(context.req.param("index")),
  );
  return blobResponse(await new R2BlobStore(context.env.BLOBS).get(key));
});

app.delete("/v1/shares/:id", async (context) => {
  const shareId = context.req.param("id");
  const metadata = new D1MetadataStore(context.env.DB);
  await requireDeleteAuthorization(metadata, shareId, authorization(context.req.raw, "Delete"));
  await new R2BlobStore(context.env.BLOBS).removePrefix(sharePrefix(shareId));
  await metadata.remove(shareId);
  return context.body(null, 204);
});

app.notFound((context) =>
  context.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404),
);

app.onError((error, context) => {
  if (error instanceof ServiceError) {
    return context.json(
      { error: { code: error.code, message: error.message } },
      error.status as 400,
    );
  }
  if (error instanceof SyntaxError || error.name === "ZodError") {
    return context.json({ error: { code: "INVALID_REQUEST", message: "Request is invalid" } }, 400);
  }

  console.error(
    JSON.stringify({
      message: "Unhandled API error",
      path: new URL(context.req.url).pathname,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  return context.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500);
});

function authorization(request: Request, scheme: string): string | null {
  const header = request.headers.get("Authorization");
  const prefix = `${scheme} `;
  return header?.startsWith(prefix) ? header.slice(prefix.length) : null;
}

async function boundedBody(request: Request, maximumBytes: number): Promise<ArrayBuffer> {
  if (!request.body) {
    throw new ServiceError(400, "BODY_REQUIRED", "Request body is required");
  }

  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength && Number(declaredLength) > maximumBytes) {
    throw new ServiceError(413, "PAYLOAD_TOO_LARGE", "Encrypted payload is too large");
  }

  // Each encrypted part is intentionally bounded to roughly 4 MiB. Buffering one part lets us
  // verify its actual size and gives R2 a body with a known length. The client still processes
  // arbitrarily large files as independent chunks.
  const body = await request.arrayBuffer();
  if (body.byteLength > maximumBytes) {
    throw new ServiceError(413, "PAYLOAD_TOO_LARGE", "Encrypted payload is too large");
  }
  return body;
}

function parseChunkIndex(value: string): number {
  if (!/^\d{1,10}$/u.test(value)) {
    throw new ServiceError(400, "INVALID_CHUNK_INDEX", "Chunk index is invalid");
  }
  const index = Number(value);
  if (!Number.isSafeInteger(index) || index > 0xffff_ffff) {
    throw new ServiceError(400, "INVALID_CHUNK_INDEX", "Chunk index is invalid");
  }
  return index;
}

function blobResponse(
  blob: { body: ReadableStream<Uint8Array>; size: number; etag: string } | null,
): Response {
  if (!blob) {
    throw new ServiceError(404, "OBJECT_NOT_FOUND", "Encrypted object not found");
  }
  return new Response(blob.body, {
    headers: {
      "Cache-Control": "no-store, private",
      "Content-Length": String(blob.size),
      "Content-Type": "application/octet-stream",
      ETag: blob.etag,
    },
  });
}

export default app;
