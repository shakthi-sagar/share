import {
  type ApiServices,
  createApi,
  type LimitedAction,
  purgeExpiredShares,
  SqlMetadataStore,
  secretMatchesHash,
  UPLOAD_WINDOW_SECONDS,
} from "@share/server";
import { R2BlobStore } from "./adapters/r2-blobs";

type WorkerEnv = Env & {
  SHARE_ALLOWED_ORIGINS: string;
  SHARE_CLEANUP_MONITOR_HASH?: string;
  SHARE_ENV: string;
  SHARE_MAX_SHARE_BYTES: string;
};

const app = createApi<WorkerEnv>(
  (env): ApiServices => ({
    metadata: new SqlMetadataStore(env.DB),
    blobs: new R2BlobStore(env.BLOBS),
    allowedOrigins: env.SHARE_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()),
    maxShareBytes: positiveInteger("SHARE_MAX_SHARE_BYTES", env.SHARE_MAX_SHARE_BYTES),
    clientAddress: (request) => request.headers.get("CF-Connecting-IP") ?? "unknown",
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

const CLEANUP_MONITOR_PATH = "/health/cleanup";
const CLEANUP_MAX_AGE_MS = 110 * 60 * 1000;

async function cleanupHealth(request: Request, env: WorkerEnv): Promise<Response> {
  const expectedHash = env.SHARE_CLEANUP_MONITOR_HASH;
  const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get("Authorization") ?? "")?.[1];
  const headers = { "Cache-Control": "no-store" };
  if (
    request.method !== "GET" ||
    !expectedHash ||
    !token ||
    !(await secretMatchesHash(token, expectedHash))
  ) {
    return new Response(null, { status: 404, headers });
  }

  const latest = await env.DB.prepare(
    "SELECT scheduled_at, succeeded FROM cleanup_monitor WHERE id = 1",
  ).first<{ scheduled_at: number; succeeded: number | null }>();
  if (latest && Date.now() - latest.scheduled_at < CLEANUP_MAX_AGE_MS) {
    if (latest.succeeded === null) {
      return Response.json({ status: "waiting" }, { status: 202, headers });
    }
    if (latest.succeeded === 1) {
      return Response.json({ status: "ok" }, { headers });
    }
  }
  return Response.json({ status: "unhealthy" }, { status: 503, headers });
}

async function recordCleanup(
  env: WorkerEnv,
  scheduledAt: number,
  succeeded: boolean,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO cleanup_monitor (id, scheduled_at, succeeded) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET scheduled_at = excluded.scheduled_at,
       succeeded = excluded.succeeded
     WHERE excluded.scheduled_at >= cleanup_monitor.scheduled_at`,
  )
    .bind(scheduledAt, Number(succeeded))
    .run();
}

async function runMonitoredSweep(env: WorkerEnv, scheduledAt: number): Promise<void> {
  let succeeded: boolean;
  try {
    succeeded = await runExpirySweep(env);
  } catch (error) {
    await recordCleanup(env, scheduledAt, false).catch(() => {
      console.error("Could not record expiry sweep failure");
    });
    throw error;
  }
  await recordCleanup(env, scheduledAt, succeeded);
}

/**
 * Cron target for the expiry sweep. Platform invocations reach the Worker directly, so the sweep has
 * no public route and cannot be triggered by a request. It logs counts only: share ids,
 * credentials, and object keys stay out of the logs.
 */
async function runExpirySweep(env: WorkerEnv): Promise<boolean> {
  const started = Date.now();
  const metadata = new SqlMetadataStore(env.DB);
  const result = await purgeExpiredShares(metadata, new R2BlobStore(env.BLOBS), new Date(started));
  const retention = await metadata
    .retentionStats(
      new Date(started).toISOString(),
      new Date(started - UPLOAD_WINDOW_SECONDS * 1000).toISOString(),
    )
    .catch(() => null);
  // Failures and backlog should surface as warning/error logs for Cloudflare log alerts.
  const log = result.failed > 0 ? console.error : result.truncated ? console.warn : console.log;
  log(
    JSON.stringify({
      severity: result.failed > 0 ? "error" : result.truncated ? "warning" : "info",
      message: "Expired share sweep completed",
      scanned: result.scanned,
      removed: result.removed,
      failed: result.failed,
      truncated: result.truncated,
      retention,
      durationMs: Date.now() - started,
    }),
  );
  return result.failed === 0;
}

export default {
  fetch: (request, env, ctx) =>
    new URL(request.url).pathname === CLEANUP_MONITOR_PATH
      ? cleanupHealth(request, env)
      : app.fetch(request, env, ctx),
  scheduled: (controller, env) => runMonitoredSweep(env, controller.scheduledTime),
} satisfies ExportedHandler<WorkerEnv>;
