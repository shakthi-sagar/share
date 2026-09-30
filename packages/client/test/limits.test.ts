import { MAX_MANIFEST_CIPHERTEXT_BYTES } from "@share/protocol";
import { describe, expect, it } from "vitest";
import { createEncryptedShare, measureShare, type ShareSourceFile } from "../src";

function source(path: string, size = 3): ShareSourceFile {
  return {
    path,
    mime: "text/plain",
    size,
    stream: () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(size));
          controller.close();
        },
      }),
  };
}

/** Fails the test if the client reaches the network. */
const offline: typeof fetch = () => {
  throw new Error("The client contacted the API");
};

function publish(files: ShareSourceFile[], maxShareBytes?: number) {
  return createEncryptedShare({
    apiBaseUrl: "http://api.invalid",
    shareBaseUrl: "http://web.invalid",
    name: "Limits",
    files,
    expiresInSeconds: 60,
    fetch: offline,
    ...(maxShareBytes === undefined ? {} : { maxShareBytes }),
  });
}

describe("share limits", () => {
  it("measures the stored ciphertext of a share", () => {
    const measurement = measureShare("Limits", [source("a.txt", 5), source("empty.txt", 0)]);
    expect(measurement).toMatchObject({ fileCount: 2, plaintextBytes: 5, chunkCount: 1 });
    expect(measurement.ciphertextBytes).toBe(5 + 16 + measurement.manifestBytes);
  });

  it("rejects a share over the operator limit before uploading", async () => {
    const files = [source("a.txt", 100)];
    const needed = measureShare("Limits", files).ciphertextBytes;
    await expect(publish(files, needed - 1)).rejects.toMatchObject({ code: "SHARE_TOO_LARGE" });
  });

  it("rejects a file list whose manifest would exceed the protocol limit", async () => {
    const longSegment = "d".repeat(200);
    const files = Array.from({ length: 6000 }, (_, index) =>
      source(`${longSegment}/${longSegment}/${index}.txt`, 0),
    );
    expect(measureShare("Limits", files).manifestBytes).toBeGreaterThan(
      MAX_MANIFEST_CIPHERTEXT_BYTES,
    );
    await expect(publish(files)).rejects.toMatchObject({ code: "MANIFEST_TOO_LARGE" });
  });

  it("rejects unsafe, spoofing, and duplicate paths before uploading", async () => {
    await expect(publish([source("../escape.txt")])).rejects.toMatchObject({ code: "UNSAFE_PATH" });
    await expect(publish([source("invoice‮fdp.exe")])).rejects.toMatchObject({
      code: "UNSAFE_PATH",
    });
    await expect(publish([source("a.txt"), source("a.txt")])).rejects.toMatchObject({
      code: "DUPLICATE_PATH",
    });
    await expect(publish([])).rejects.toMatchObject({ code: "NO_FILES" });
  });
});
