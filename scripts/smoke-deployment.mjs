import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
process.loadEnvFile(join(repositoryRoot, ".env"));

const apiBaseUrl = required("SHARE_PUBLIC_API_URL").replace(/\/$/u, "");
const webBaseUrl = required("SHARE_PUBLIC_WEB_URL").replace(/\/$/u, "");
const origin = new URL(webBaseUrl).origin;
let created;

try {
  const health = await request(`${apiBaseUrl}/health`);
  if ((await health.json()).status !== "ok") throw new Error("Health response was invalid");

  const home = await request(`${webBaseUrl}/`);
  if (!(await home.text()).includes('<div id="root"></div>')) {
    throw new Error("The deployed web shell was not returned");
  }

  const preflight = await request(`${apiBaseUrl}/v1/shares`, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
  });
  if (preflight.headers.get("access-control-allow-origin") !== origin) {
    throw new Error("The configured web origin was not allowed by CORS");
  }

  created = await request(`${apiBaseUrl}/v1/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresInSeconds: 3600 }),
  }).then((response) => response.json());

  const objectId = randomBase64Url(16);
  const chunk = crypto.getRandomValues(new Uint8Array(128));
  const manifest = crypto.getRandomValues(new Uint8Array(96));
  const readCredential = randomBase64Url(32);
  const uploadHeaders = { Authorization: `Upload ${created.uploadToken}` };

  await request(`${apiBaseUrl}/v1/shares/${created.id}/objects/${objectId}/chunks/0`, {
    method: "PUT",
    headers: uploadHeaders,
    body: chunk,
  });
  await request(`${apiBaseUrl}/v1/shares/${created.id}/manifest`, {
    method: "PUT",
    headers: uploadHeaders,
    body: manifest,
  });
  await request(`${apiBaseUrl}/v1/shares/${created.id}/complete`, {
    method: "POST",
    headers: { ...uploadHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      accessCredentialHash: await sha256Base64Url(readCredential),
      objectCount: 1,
      chunkCount: 1,
      ciphertextBytes: chunk.byteLength + manifest.byteLength,
    }),
  });

  const readHeaders = { Authorization: `Share ${readCredential}` };
  const downloadedManifest = new Uint8Array(
    await request(`${apiBaseUrl}/v1/shares/${created.id}/manifest`, {
      headers: readHeaders,
    }).then((response) => response.arrayBuffer()),
  );
  const downloadedChunk = new Uint8Array(
    await request(`${apiBaseUrl}/v1/shares/${created.id}/objects/${objectId}/chunks/0`, {
      headers: readHeaders,
    }).then((response) => response.arrayBuffer()),
  );

  if (!equalBytes(manifest, downloadedManifest) || !equalBytes(chunk, downloadedChunk)) {
    throw new Error("Downloaded ciphertext did not match the uploaded bytes");
  }

  console.log(`Deployment smoke test passed: ${webBaseUrl}`);
} finally {
  if (created?.id && created?.deleteToken) {
    await fetch(`${apiBaseUrl}/v1/shares/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Delete ${created.deleteToken}` },
    });
  }
}

async function request(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${url} returned ${response.status}`);
  }
  return response;
}

function randomBase64Url(byteLength) {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(byteLength))).toString("base64url");
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("base64url");
}

function equalBytes(left, right) {
  return (
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
  );
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
