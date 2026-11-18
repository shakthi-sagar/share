/** Synthetic browser-side manifest benchmark, no real files or ciphertext are generated. */
import { performance } from "node:perf_hooks";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: ["apps/web/src/lib/file-tree.ts"],
  platform: "node",
  format: "esm",
  bundle: true,
  write: false,
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`;
const { buildFileTree } = await import(moduleUrl);
const count = Number(process.env.SHARE_BENCH_COUNT ?? 10000);
if (!Number.isSafeInteger(count) || count < 1 || count > 100000)
  throw Error("Count must be 1..100000");
const files = Array.from({ length: count }, (_, index) => ({
  id: `file-${index}`,
  path: `folder-${String(Math.floor(index / 200)).padStart(3, "0")}/image-${String(index).padStart(6, "0")}.png`,
  size: index * 117,
  mime: "image/png",
}));
const startHeap = process.memoryUsage().heapUsed;
const start = performance.now();
const tree = buildFileTree(files);
const nameMs = performance.now() - start;
const startSort = performance.now();
buildFileTree(files, "largest");
const largestMs = performance.now() - startSort;
const queryStart = performance.now();
const matched = files.filter((file) => file.path.includes("/image-000"));
const filterMs = performance.now() - queryStart;
const heapDeltaMiB = Math.max(0, process.memoryUsage().heapUsed - startHeap) / 1024 ** 2;
const results = {
  count,
  directoryCount: tree.length,
  matched: matched.length,
  nameMs: Math.round(nameMs),
  largestMs: Math.round(largestMs),
  filterMs: Math.round(filterMs),
  heapDeltaMiB: Math.round(heapDeltaMiB * 10) / 10,
};
console.log(JSON.stringify(results));
if (nameMs > 2000 || largestMs > 2000)
  throw Error("File-tree synthetic regression: build > 2 seconds");
