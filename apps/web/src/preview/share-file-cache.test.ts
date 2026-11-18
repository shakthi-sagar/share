import type { UnlockedShare } from "@share/client";
import type { ManifestFile } from "@share/protocol";
import { expect, it, vi } from "vitest";
import { mediaRange } from "./StreamedMedia";
import { CACHE_FILE_LIMIT, readShareBlob } from "./share-file-cache";

function fixture(size = 4, id = "1"): ManifestFile {
  return { id, path: "file", mime: "text/plain", size, chunkSize: 4, chunks: 1, noncePrefix: "" };
}

function shareFixture(files: ManifestFile[]): UnlockedShare {
  return {
    id: "share",
    manifest: { version: 1, name: "share", files },
    openFile: vi.fn(() => new Blob(["test"]).stream()),
  };
}

it("shares concurrent and repeated reads and isolates different unlocked shares", async () => {
  const file = fixture();
  const share = shareFixture([file]);
  const read = readShareBlob(share, file);
  expect(readShareBlob(share, file)).toBe(read);
  await expect(read.then((blob) => blob.text())).resolves.toBe("test");
  expect(readShareBlob(share, file)).toBe(read);
  expect(share.openFile).toHaveBeenCalledTimes(1);
  expect(readShareBlob(shareFixture([file]), file)).not.toBe(read);
});

it("evicts least recently used files and bypasses the cache for large files", async () => {
  const files = Array.from({ length: 5 }, (_, index) => fixture(CACHE_FILE_LIMIT, String(index)));
  const [first, second] = files;
  if (!first || !second) throw new Error("missing fixtures");
  const big = fixture(CACHE_FILE_LIMIT + 1, "big");
  const share = shareFixture([...files, big]);
  for (const file of files.slice(0, 4)) await readShareBlob(share, file);
  await readShareBlob(share, first);
  const last = files.at(-1);
  if (!last) throw new Error("missing fixture");
  await readShareBlob(share, last);
  await readShareBlob(share, first);
  expect(share.openFile).toHaveBeenCalledTimes(5);
  await readShareBlob(share, second);
  expect(share.openFile).toHaveBeenCalledTimes(6);
  await readShareBlob(share, big);
  await readShareBlob(share, big);
  expect(share.openFile).toHaveBeenCalledTimes(8);
});

it("retrying a failed read starts a new read", async () => {
  const file = fixture();
  const share = shareFixture([file]);
  vi.mocked(share.openFile).mockImplementationOnce(
    () =>
      new ReadableStream({
        pull(controller) {
          controller.error(new Error("read failed"));
        },
      }),
  );
  await expect(readShareBlob(share, file)).rejects.toThrow("read failed");
  await expect(readShareBlob(share, file)).resolves.toBeInstanceOf(Blob);
  expect(share.openFile).toHaveBeenCalledTimes(2);
});

it("accepts the single byte ranges emitted by media players", () => {
  expect(mediaRange(null, 100)).toEqual([0, 100]);
  expect(mediaRange("bytes=12-18", 100)).toEqual([12, 19]);
  expect(mediaRange("bytes=90-", 100)).toEqual([90, 100]);
  expect(mediaRange("bytes=-5", 100)).toEqual([95, 100]);
  expect(mediaRange("bytes=100-", 100)).toBeNull();
  expect(mediaRange("bytes=0-1,5-6", 100)).toBeNull();
});
