import type { UnlockedShare } from "@share/client";
import type { ManifestFile } from "@share/protocol";

export const CACHE_FILE_LIMIT = 16 * 1024 ** 2;
const CACHE_BUDGET = 64 * 1024 ** 2;
// Bound entry overhead as well as file bytes (a share can contain thousands of empty files).
const MAX_ENTRIES = 256;

type Entry = { data: Promise<Blob>; size: number; pending: boolean };
type Cache = { bytes: number; entries: Map<string, Entry> };
const caches = new WeakMap<UnlockedShare, Cache>();

export function readShareBlob(share: UnlockedShare, file: ManifestFile): Promise<Blob> {
  const read = () => new Response(share.openFile(file)).blob();
  if (file.size > CACHE_FILE_LIMIT) return read();

  let cache = caches.get(share);
  if (!cache) {
    cache = { bytes: 0, entries: new Map() };
    caches.set(share, cache);
  }
  const { entries } = cache;
  const existing = entries.get(file.id);
  if (existing) {
    entries.delete(file.id);
    entries.set(file.id, existing);
    return existing.data;
  }

  for (const [id, entry] of entries) {
    if (cache.bytes + file.size <= CACHE_BUDGET && entries.size < MAX_ENTRIES) break;
    if (entry.pending) continue;
    entries.delete(id);
    cache.bytes -= entry.size;
  }
  if (cache.bytes + file.size > CACHE_BUDGET || entries.size >= MAX_ENTRIES) return read();

  const activeCache = cache;
  const entry: Entry = {
    size: file.size,
    pending: true,
    data: read().then(
      (blob) => {
        entry.pending = false;
        return blob;
      },
      (error: unknown) => {
        entries.delete(file.id);
        activeCache.bytes -= entry.size;
        throw error;
      },
    ),
  };
  entries.set(file.id, entry);
  cache.bytes += file.size;
  return entry.data;
}
