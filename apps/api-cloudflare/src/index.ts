import { purgeExpiredShares } from "@share/server";
import { D1MetadataStore } from "./adapters/d1-metadata";
import { R2BlobStore } from "./adapters/r2-blobs";
import { type ApiServices, createApi, type LimitedAction } from "./app";

type WorkerEnv = Env & {
  SHARE_ALLOWED_ORIGINS: string;
  SHARE_ENV: string;
  SHARE_MAX_SHARE_BYTES: string;
};

const app = createApi<WorkerEnv>(
  (env): ApiServices => ({
    metadata: new D1MetadataStore(env.DB),
    blobs: new R2BlobStore(env.BLOBS),
    allowedOrigins: env.SHARE_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()),
    maxShareBytes: positiveInteger("SHARE_MAX_SHARE_BYTES", env.SHARE_MAX_SHARE_BYTES),
    allow: async (action, key) => (await limiter(env, action).limit({ key })).success,
  }),
);

function limiter(env: WorkerEnv, action: LimitedAction): RateLimit {
  return action === "create" ? env.CREATE_RATE_LIMITER : env.UPLOAD_RATE_LIMITER;
}

function positiveInteger(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} is not configured`);
  }
  return parsed;
}

/**
 * Cron target for the expiry sweep. Platform invocations reach the Worker directly, so the sweep has
 * no public route and cannot be triggered by a request. It logs counts only: share ids,
 * credentials, and object keys stay out of the logs.
 */
async function runExpirySweep(env: WorkerEnv): Promise<void> {
  const started = Date.now();
  const result = await purgeExpiredShares(new D1MetadataStore(env.DB), new R2BlobStore(env.BLOBS));
  console.log(
    JSON.stringify({
      message: "Expired share sweep completed",
      scanned: result.scanned,
      removed: result.removed,
      failed: result.failed,
      truncated: result.truncated,
      durationMs: Date.now() - started,
    }),
  );
}

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
  scheduled: (_controller, env) => runExpirySweep(env),
} satisfies ExportedHandler<WorkerEnv>;
