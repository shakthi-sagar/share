import {
  ApiError,
  createEncryptedShare,
  deleteEncryptedShare,
  type ShareSourceFile,
  unlockEncryptedShare,
} from "@share/client";
import { DEFAULT_CHUNK_SIZE } from "@share/protocol";
import { MemoryBlobStore, MemoryMetadataStore } from "@share/server/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { type ApiServices, createApi, type LimitedAction } from "../src/app";

const origin = "https://share.example";
const apiBaseUrl = "https://api.example";
const absentShareId = "AAAAAAAAAAAAAAAAAAAAAA";

let metadata: MemoryMetadataStore;
let blobs: MemoryBlobStore;
let blocked: Set<LimitedAction>;
let maxShareBytes: number;
let request: typeof fetch;

beforeEach(() => {
  metadata = new MemoryMetadataStore();
  blobs = new MemoryBlobStore();
  blocked = new Set();
  maxShareBytes = 64 * 1024 * 1024;
  const app = createApi<object>(
    (): ApiServices => ({
      metadata,
      blobs,
      allowedOrigins: [origin],
      maxShareBytes,
      allow: async (action) => !blocked.has(action),
    }),
  );
  request = async (input, init) => app.request(String(input), init);
});

function source(path: string, bytes: Uint8Array): ShareSourceFile {
  return {
    path,
    mime: "application/octet-stream",
    size: bytes.byteLength,
    stream: () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
  };
}

function patterned(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 31 + 7) % 251);
}

async function publish(files: ShareSourceFile[], expiresInSeconds: number | null = 3600) {
  return createEncryptedShare({
    apiBaseUrl,
    shareBaseUrl: origin,
    name: "Fixture",
    files,
    expiresInSeconds,
    fetch: request,
  });
}

async function errorOf(response: Response): Promise<{ status: number; body: unknown }> {
  return { status: response.status, body: await response.json() };
}

describe("encrypted share API", () => {
  it("round trips a multi-chunk share through the real client", async () => {
    const large = patterned(DEFAULT_CHUNK_SIZE + 1234);
    const small = new TextEncoder().encode("# Notes\n");
    const created = await publish([
      source("assets/large.bin", large),
      source("notes.md", small),
      source("empty.txt", new Uint8Array()),
    ]);

    const unlocked = await unlockEncryptedShare({
      apiBaseUrl,
      id: created.id,
      key: created.key,
      fetch: request,
    });
    expect(unlocked.manifest.files.map((file) => file.path)).toEqual([
      "assets/large.bin",
      "notes.md",
      "empty.txt",
    ]);
    for (const [file, expected] of [
      [unlocked.manifest.files[0], large],
      [unlocked.manifest.files[1], small],
      [unlocked.manifest.files[2], new Uint8Array()],
    ] as const) {
      if (!file) throw new Error("missing file");
      const bytes = new Uint8Array(await new Response(unlocked.openFile(file)).arrayBuffer());
      expect(bytes.byteLength).toBe(expected.byteLength);
      expect(Buffer.compare(bytes, expected)).toBe(0);
    }

    const record = await metadata.find(created.id);
    expect(record).toMatchObject({ state: "ready", objectCount: 3, chunkCount: 3 });
    expect(record?.ciphertextBytes).toBe(record?.reservedBytes);

    await deleteEncryptedShare(apiBaseUrl, created.id, created.deleteToken, request);
    expect(blobs.objects.size).toBe(0);
    await expect(
      unlockEncryptedShare({ apiBaseUrl, id: created.id, key: created.key, fetch: request }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("stores no plaintext, names, or paths", async () => {
    const created = await publish([
      source("secret-folder/secret-name.txt", new TextEncoder().encode("plaintext marker")),
    ]);
    const stored = new TextDecoder().decode(
      new Uint8Array([...blobs.objects.values()].flatMap((bytes) => [...bytes])),
    );
    expect(stored).not.toContain("plaintext marker");
    expect(stored).not.toContain("secret-name");
    expect(JSON.stringify(await metadata.find(created.id))).not.toContain(created.key);
  });

  it("answers absent, locked, and wrong-key reads identically", async () => {
    const created = await publish([source("a.txt", new Uint8Array(4))]);
    const wrongKey = "A".repeat(43);
    const responses = await Promise.all([
      request(`${apiBaseUrl}/v1/shares/${created.id}/manifest`),
      request(`${apiBaseUrl}/v1/shares/${absentShareId}/manifest`),
      request(`${apiBaseUrl}/v1/shares/${created.id}/manifest`, {
        headers: { Authorization: `Share ${wrongKey}` },
      }),
      request(`${apiBaseUrl}/v1/shares/not-a-share-id/manifest`),
    ]);
    const bodies = await Promise.all(responses.map(errorOf));
    for (const body of bodies) {
      expect(body).toEqual(bodies[0]);
    }
    expect(bodies[0]).toMatchObject({ status: 404, body: { error: { code: "SHARE_NOT_FOUND" } } });
  });

  it("does not reveal an expired upload to a caller without its token", async () => {
    const response = await request(`${apiBaseUrl}/v1/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresInSeconds: 1 }),
    });
    const { id } = (await response.json()) as { id: string };
    const record = metadata.records.get(id);
    if (!record) throw new Error("missing record");
    record.expiresAt = new Date(Date.now() - 1000).toISOString();

    const [expired, absent] = await Promise.all(
      [id, absentShareId].map((shareId) =>
        request(`${apiBaseUrl}/v1/shares/${shareId}/manifest`, {
          method: "PUT",
          headers: { Authorization: `Upload ${"B".repeat(43)}` },
          body: new Uint8Array(40),
        }).then(errorOf),
      ),
    );
    expect(expired).toEqual(absent);
    expect(expired.status).toBe(404);
  });

  it("treats malformed object ids and chunk indices as client errors", async () => {
    const response = await request(`${apiBaseUrl}/v1/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresInSeconds: 60 }),
    });
    const { id, uploadToken } = (await response.json()) as { id: string; uploadToken: string };
    const put = (path: string) =>
      request(`${apiBaseUrl}/v1/shares/${id}${path}`, {
        method: "PUT",
        headers: { Authorization: `Upload ${uploadToken}` },
        body: new Uint8Array(20),
      });

    expect((await put("/objects/short/chunks/0")).status).toBe(400);
    expect((await put("/objects/FileObject_123456/chunks/99999999999")).status).toBe(400);
    expect((await put("/objects/FileObject_123456/chunks/0")).status).toBe(204);
  });

  it("enforces the share size limit on the server", async () => {
    maxShareBytes = 1024;
    await expect(publish([source("big.bin", new Uint8Array(2048))])).rejects.toMatchObject({
      status: 413,
      code: "SHARE_TOO_LARGE",
    });
  });

  it("refuses completion before the manifest is uploaded", async () => {
    const response = await request(`${apiBaseUrl}/v1/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresInSeconds: 60 }),
    });
    const { id, uploadToken } = (await response.json()) as { id: string; uploadToken: string };
    const completion = await request(`${apiBaseUrl}/v1/shares/${id}/complete`, {
      method: "POST",
      headers: { Authorization: `Upload ${uploadToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        accessCredentialHash: "A".repeat(43),
        objectCount: 0,
        chunkCount: 0,
        ciphertextBytes: 0,
      }),
    });
    expect(await errorOf(completion)).toMatchObject({
      status: 409,
      body: { error: { code: "MANIFEST_MISSING" } },
    });
  });

  it("rate limits share creation and uploads", async () => {
    blocked.add("create");
    const limited = await request(`${apiBaseUrl}/v1/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresInSeconds: 60 }),
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(metadata.records.size).toBe(0);

    blocked.clear();
    blocked.add("upload");
    await expect(publish([source("a.txt", new Uint8Array(4))])).rejects.toBeInstanceOf(ApiError);
    expect(blobs.objects.size).toBe(0);
  });

  it("allows only configured browser origins", async () => {
    const preflight = (from: string) =>
      request(`${apiBaseUrl}/v1/shares`, {
        method: "OPTIONS",
        headers: {
          Origin: from,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      });
    expect((await preflight(origin)).headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(
      (await preflight("https://evil.example")).headers.get("Access-Control-Allow-Origin"),
    ).toBeNull();
  });

  it("sends security headers and keeps encrypted bodies out of caches", async () => {
    const created = await publish([source("a.txt", new Uint8Array(4))]);
    const unlocked = await unlockEncryptedShare({
      apiBaseUrl,
      id: created.id,
      key: created.key,
      fetch: async (input, init) => {
        const response = await request(input, init);
        expect(response.headers.get("Cache-Control")).toBe("no-store, private");
        expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
        expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
        return response;
      },
    });
    expect(unlocked.manifest.files).toHaveLength(1);
  });
});
