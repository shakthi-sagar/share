import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  createApi,
  type LimitedAction,
  purgeExpiredShares,
  UPLOAD_WINDOW_SECONDS,
} from "@share/server";
import { Hono } from "hono";
import { S3BlobStore } from "./s3-blobs";
import { openMetadata } from "./sqlite";

const port = positive("PORT", 8787);
const origin = new URL(process.env.SHARE_NODE_ORIGIN ?? "http://localhost:8787").origin;
const webRoot = resolve(process.env.SHARE_NODE_WEB_ROOT ?? "apps/web/dist");
const storageFile = resolve(process.env.SHARE_NODE_DATABASE ?? "data/share.sqlite");
mkdirSync(dirname(storageFile), { recursive: true, mode: 0o700 });
const metadata = openMetadata(
  storageFile,
  resolve(process.env.SHARE_NODE_MIGRATIONS ?? "apps/api-cloudflare/migrations"),
);
const endpoint = process.env.SHARE_S3_ENDPOINT;
const bucket = process.env.SHARE_S3_BUCKET;
if (!bucket) throw new Error("SHARE_S3_BUCKET is required");
const blobs = new S3BlobStore(
  new S3Client({
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    region: process.env.AWS_REGION ?? "us-east-1",
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  }),
  bucket,
);

type Bindings = { address: string };
const app = new Hono<{ Bindings: Bindings }>();
const maxShareBytes = positive("SHARE_NODE_MAX_SHARE_BYTES", 2_147_483_648);
const window = new Map<string, [number, number]>();
const api = createApi<Bindings>(({ address }) => ({
  metadata,
  blobs,
  allowedOrigins: [origin],
  maxShareBytes,
  clientAddress: () => address,
  allow: async (action, key) => allow(action, key),
}));

const securityHeaders = readFileSync(resolve(webRoot, "_headers"), "utf8")
  .split("\n")
  .flatMap((line) => {
    const match = /^\s+([^:]+): (.*)$/u.exec(line);
    return match?.[1] && match[2] ? [[match[1], match[2]] as const] : [];
  });
app.use("*", async (context, next) => {
  await next();
  for (const [name, value] of securityHeaders) context.header(name, value);
});
app.get("/health", (context) => api.fetch(context.req.raw, context.env));
app.all("/v1/*", (context) => api.fetch(context.req.raw, context.env));
app.get("/_headers", (context) => context.notFound());
app.get("*", serveStatic({ root: webRoot }));
app.get("*", (context) => {
  const pathname = context.req.path;
  if (pathname !== "/" && !/^\/(?:s|w|docs)(?:\/|$)/u.test(pathname)) return context.notFound();
  context.header("Cache-Control", "no-cache");
  return context.html(readFileSync(resolve(webRoot, "index.html"), "utf8"));
});

const server = serve({
  fetch: (request, env) =>
    app.fetch(request, {
      address: env.incoming.socket.remoteAddress ?? "unknown",
    }),
  hostname: "0.0.0.0",
  port,
});
server.on("listening", () => console.log("Share is listening on port", port));
const rateTimer = setInterval(() => window.clear(), 60_000);
const sweepTimer = setInterval(() => void sweep(), 60 * 60 * 1000);
let sweepInFlight = false;
void sweep();

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    clearInterval(rateTimer);
    clearInterval(sweepTimer);
    server.close();
  });
}

function allow(action: LimitedAction, address: string): boolean {
  const index = action === "create" ? 0 : 1;
  const limit = action === "create" ? 10 : 600;
  let counts = window.get(address);
  if (!counts) {
    counts = [0, 0];
    window.set(address, counts);
  }
  return ++counts[index] <= limit;
}

async function sweep(): Promise<void> {
  if (sweepInFlight) return;
  sweepInFlight = true;
  const now = new Date();
  try {
    const result = await purgeExpiredShares(metadata, blobs, now);
    const retention = await metadata.retentionStats(
      now.toISOString(),
      new Date(now.getTime() - UPLOAD_WINDOW_SECONDS * 1000).toISOString(),
    );
    console.log(JSON.stringify({ message: "Expired share sweep completed", ...result, retention }));
  } catch {
    console.error("Expired share sweep failed");
  } finally {
    sweepInFlight = false;
  }
}

function positive(name: string, fallback: number): number {
  const value = process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer`);
  return value;
}
