import {
  completeShareRequestSchema,
  createShareRequestSchema,
  MAX_CHUNK_CIPHERTEXT_BYTES,
  MAX_MANIFEST_CIPHERTEXT_BYTES,
  ProtocolError,
} from "@share/protocol";
import {
  type BlobStore,
  chunkObjectKey,
  completeShare,
  createShare,
  deleteShare,
  type MetadataStore,
  manifestObjectKey,
  requireReadAuthorization,
  requireUploadAuthorization,
  reserveUpload,
  ServiceError,
} from "@share/server";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

/** Actions that are rate limited per client address. */
export type LimitedAction = "create" | "upload";

/** Everything a request needs from the platform, resolved once per request from the bindings. */
export interface ApiServices {
  metadata: MetadataStore;
  blobs: BlobStore;
  allowedOrigins: string[];
  maxShareBytes: number;
  /** Resolves false when `key` has exceeded the rate limit for `action`. */
  allow(action: LimitedAction, key: string): Promise<boolean>;
}

type ApiEnv<Bindings extends object> = {
  Bindings: Bindings;
  Variables: { services: ApiServices };
};

/** Seconds a rate-limited client should wait. Matches the platform's longest limit period. */
const RATE_LIMIT_RETRY_SECONDS = 60;

export function createApi<Bindings extends object>(
  resolve: (env: Bindings) => ApiServices,
): Hono<ApiEnv<Bindings>> {
  const app = new Hono<ApiEnv<Bindings>>();

  app.use("*", async (context, next) => {
    context.set("services", resolve(context.env));
    await next();
  });
  app.use("*", secureHeaders({ referrerPolicy: "no-referrer" }));
  app.use("/v1/*", (context, next) =>
    cors({
      origin: (origin) =>
        context.var.services.allowedOrigins.includes(origin) ? origin : undefined,
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      maxAge: 86400,
    })(context, next),
  );

  app.get("/health", (context) => context.json({ status: "ok" }));

  app.post("/v1/shares", async (context) => {
    const { metadata } = context.var.services;
    await requireWithinLimit(context, "create");
    const input = createShareRequestSchema.parse(await context.req.json());
    const result = await createShare(metadata, input);
    return context.json(result, 201);
  });

  app.put("/v1/shares/:id/manifest", async (context) => {
    const { metadata, blobs, maxShareBytes } = context.var.services;
    const shareId = context.req.param("id");
    await requireWithinLimit(context, "upload");
    await requireUploadAuthorization(metadata, shareId, authorization(context.req.raw, "Upload"));
    const body = await boundedBody(context.req.raw, MAX_MANIFEST_CIPHERTEXT_BYTES);
    await reserveUpload(metadata, shareId, { bytes: body.byteLength, chunks: 0 }, maxShareBytes);
    await blobs.put(manifestObjectKey(shareId), body);
    return context.body(null, 204);
  });

  app.put("/v1/shares/:id/objects/:objectId/chunks/:index", async (context) => {
    const { metadata, blobs, maxShareBytes } = context.var.services;
    const shareId = context.req.param("id");
    await requireWithinLimit(context, "upload");
    await requireUploadAuthorization(metadata, shareId, authorization(context.req.raw, "Upload"));
    const key = chunkObjectKey(
      shareId,
      context.req.param("objectId"),
      parseChunkIndex(context.req.param("index")),
    );
    const body = await boundedBody(context.req.raw, MAX_CHUNK_CIPHERTEXT_BYTES);
    await reserveUpload(metadata, shareId, { bytes: body.byteLength, chunks: 1 }, maxShareBytes);
    await blobs.put(key, body);
    return context.body(null, 204);
  });

  app.post("/v1/shares/:id/complete", async (context) => {
    const { metadata, blobs } = context.var.services;
    const shareId = context.req.param("id");
    await requireWithinLimit(context, "upload");
    await requireUploadAuthorization(metadata, shareId, authorization(context.req.raw, "Upload"));
    if (!(await blobs.exists(manifestObjectKey(shareId)))) {
      throw new ServiceError(409, "MANIFEST_MISSING", "Upload the encrypted manifest first");
    }
    const completion = completeShareRequestSchema.parse(await context.req.json());
    await completeShare(metadata, shareId, completion);
    return context.body(null, 204);
  });

  app.get("/v1/shares/:id/manifest", async (context) => {
    const { metadata, blobs } = context.var.services;
    const shareId = context.req.param("id");
    await requireReadAuthorization(metadata, shareId, authorization(context.req.raw, "Share"));
    return blobResponse(await blobs.get(manifestObjectKey(shareId)));
  });

  app.get("/v1/shares/:id/objects/:objectId/chunks/:index", async (context) => {
    const { metadata, blobs } = context.var.services;
    const shareId = context.req.param("id");
    await requireReadAuthorization(metadata, shareId, authorization(context.req.raw, "Share"));
    const key = chunkObjectKey(
      shareId,
      context.req.param("objectId"),
      parseChunkIndex(context.req.param("index")),
    );
    return blobResponse(await blobs.get(key));
  });

  app.delete("/v1/shares/:id", async (context) => {
    const { metadata, blobs } = context.var.services;
    await deleteShare(
      metadata,
      blobs,
      context.req.param("id"),
      authorization(context.req.raw, "Delete"),
    );
    return context.body(null, 204);
  });

  app.notFound((context) =>
    context.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404),
  );
  app.onError((error, context) => {
    if (error instanceof ServiceError) {
      if (error.status === 429) {
        context.header("Retry-After", String(RATE_LIMIT_RETRY_SECONDS));
      }
      return context.json(
        { error: { code: error.code, message: error.message } },
        error.status as 400,
      );
    }
    // Malformed JSON, schema violations, and invalid ids or indices in a path are client errors.
    if (
      error instanceof SyntaxError ||
      error instanceof ProtocolError ||
      error.name === "ZodError"
    ) {
      return context.json(
        { error: { code: "INVALID_REQUEST", message: "Request is invalid" } },
        400,
      );
    }

    console.error(
      JSON.stringify({
        message: "Unhandled API error",
        method: context.req.method,
        route: context.req.routePath,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return context.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      500,
    );
  });

  return app;
}

/**
 * Keys limits by the client address the platform reports. The address is used only as a limiter
 * key and is never logged or stored.
 */
async function requireWithinLimit<Bindings extends object>(
  context: Context<ApiEnv<Bindings>>,
  action: LimitedAction,
): Promise<void> {
  const address = context.req.header("CF-Connecting-IP") ?? "unknown";
  if (!(await context.var.services.allow(action, address))) {
    throw new ServiceError(429, "RATE_LIMITED", "Too many requests. Try again shortly.");
  }
}

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
