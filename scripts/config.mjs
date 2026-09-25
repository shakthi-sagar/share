import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const argumentsList = process.argv.slice(2);
const command = argumentsList.find((argument) => !argument.startsWith("--")) ?? "check";
const requestedEnvFile = optionValue("--env-file") ?? ".env";
const envFile = isAbsolute(requestedEnvFile)
  ? requestedEnvFile
  : resolve(repositoryRoot, requestedEnvFile);
const production = argumentsList.includes("--production");

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const config = readConfig({ production });

if (command === "sync") {
  const outputPath = join(repositoryRoot, "apps/api-cloudflare/wrangler.generated.jsonc");
  const basePath = join(repositoryRoot, "apps/api-cloudflare/wrangler.base.jsonc");
  const base = JSON.parse(readFileSync(basePath, "utf8"));
  const apiUrl = new URL(config.publicApiUrl);
  const generated = {
    ...base,
    name: config.cloudflare.workerName,
    ...(config.cloudflare.accountId ? { account_id: config.cloudflare.accountId } : {}),
    ...(config.customDomain
      ? { routes: [{ pattern: config.customDomain, custom_domain: true }] }
      : {}),
    vars: {
      SHARE_ENV: config.environment,
      SHARE_ALLOWED_ORIGINS: config.allowedOrigins.join(","),
    },
    d1_databases: [
      {
        binding: "DB",
        database_name: config.cloudflare.d1Name,
        database_id: config.cloudflare.d1Id,
        migrations_dir: "migrations",
      },
    ],
    r2_buckets: [
      {
        binding: "BLOBS",
        bucket_name: config.cloudflare.r2Bucket,
      },
    ],
    dev: {
      ip: "127.0.0.1",
      port: localPort(apiUrl, 8787),
    },
  };

  writeFileSync(outputPath, `${JSON.stringify(generated, null, 2)}\n`);
  console.log(`Generated ${outputPath}`);
} else if (command !== "check") {
  throw new Error(`Unknown config command: ${command}`);
}

console.log(`Configuration valid for ${config.environment}`);

function readConfig({ production: requireProduction }) {
  const environment = required("SHARE_ENV");
  if (environment !== "development" && environment !== "production") {
    fail("SHARE_ENV must be development or production");
  }

  const publicWebUrl = normalizedUrl("SHARE_PUBLIC_WEB_URL");
  const publicApiUrl = normalizedUrl("SHARE_PUBLIC_API_URL");
  const defaultExpirySeconds = integer("SHARE_PUBLIC_DEFAULT_EXPIRY_SECONDS");
  const allowedExpiryValues = new Set([3600, 86400, 604800, 2592000]);
  if (!allowedExpiryValues.has(defaultExpirySeconds)) {
    fail("SHARE_PUBLIC_DEFAULT_EXPIRY_SECONDS must be one of 3600, 86400, 604800, or 2592000");
  }

  const allowedOrigins = (process.env.SHARE_ALLOWED_ORIGINS || publicWebUrl)
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/u, ""))
    .filter(Boolean);
  if (allowedOrigins.length === 0) fail("SHARE_ALLOWED_ORIGINS must contain at least one origin");
  for (const origin of allowedOrigins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin) fail(`Invalid origin in SHARE_ALLOWED_ORIGINS: ${origin}`);
  }

  const cloudflare = {
    workerName: resourceName("CLOUDFLARE_WORKER_NAME"),
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "",
    d1Name: resourceName("CLOUDFLARE_D1_NAME"),
    d1Id: required("CLOUDFLARE_D1_ID"),
    r2Bucket: resourceName("CLOUDFLARE_R2_BUCKET"),
  };
  const customDomain = process.env.SHARE_CUSTOM_DOMAIN?.trim() ?? "";
  if (customDomain) {
    const customDomainUrl = new URL(`https://${customDomain}`);
    if (
      customDomainUrl.hostname !== customDomain ||
      customDomainUrl.origin !== `https://${customDomain}`
    ) {
      fail("SHARE_CUSTOM_DOMAIN must be a hostname without a scheme or path");
    }
  }

  if (!/^[0-9a-f-]{36}$/iu.test(cloudflare.d1Id)) {
    fail("CLOUDFLARE_D1_ID must be a D1 database UUID");
  }

  if (requireProduction || environment === "production") {
    for (const [name, value] of [
      ["SHARE_PUBLIC_WEB_URL", publicWebUrl],
      ["SHARE_PUBLIC_API_URL", publicApiUrl],
    ]) {
      if (new URL(value).protocol !== "https:") fail(`${name} must use HTTPS in production`);
    }
    if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/u.test(cloudflare.d1Id)) {
      fail("CLOUDFLARE_D1_ID must reference a provisioned database in production");
    }
    // Why: Vite loads .env.local in every mode, so a local override would leak
    // development URLs into the production bundle. Block the deploy instead.
    for (const localEnvFile of [".env.local", ".env.production.local"]) {
      if (existsSync(join(repositoryRoot, localEnvFile))) {
        fail(
          `${localEnvFile} overrides production values during the Vite build. Move local overrides to .env.development or remove the file.`,
        );
      }
    }
  }

  return {
    environment,
    publicWebUrl,
    publicApiUrl,
    defaultExpirySeconds,
    allowedOrigins,
    customDomain,
    cloudflare,
  };
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is required. Set it in ${envFile}`);
  return value;
}

function normalizedUrl(name) {
  const parsed = new URL(required(name));
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    fail(`${name} must use HTTP or HTTPS`);
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    fail(`${name} must be an origin without a path, query, or fragment`);
  }
  return parsed.origin;
}

function integer(name) {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value < 0) fail(`${name} must be a non-negative integer`);
  return value;
}

function resourceName(name) {
  const value = required(name);
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u.test(value)) {
    fail(`${name} must contain 3-63 lowercase letters, numbers, or hyphens`);
  }
  return value;
}

function localPort(url, fallback) {
  if (url.port) return Number(url.port);
  return url.protocol === "https:" ? 443 : fallback;
}

function optionValue(name) {
  const index = argumentsList.indexOf(name);
  return index >= 0 ? argumentsList[index + 1] : undefined;
}

function fail(message) {
  throw new Error(`Configuration error: ${message}`);
}
