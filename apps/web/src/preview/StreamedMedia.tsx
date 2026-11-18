import type { UnlockedShare } from "@share/client";
import type { ManifestFile } from "@share/protocol";
import { useEffect, useState } from "react";
import { safeMediaType } from "./kinds";
import { MediaPlayer } from "./MediaViews";

export function mediaRange(header: string | null, size: number): [number, number] | null {
  if (!header) return [0, size];
  const match = /^bytes=(\d*)-(\d*)$/u.exec(header);
  if (!match || !(match[1] || match[2]) || size === 0) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size, Number(match[2]) + 1) : size;
  return start < end ? [start, end] : null;
}

// Media engines often request overlapping ranges during startup and seeking. Reuse the
// last two authenticated chunks for the active player, including reads already in flight.
function mediaReader(share: UnlockedShare, file: ManifestFile, signal: AbortSignal) {
  const chunks = new Map<number, Promise<Uint8Array>>();
  return (start: number, end: number): ReadableStream<Uint8Array> => {
    let offset = start;
    let cancelled = false;
    return new ReadableStream(
      {
        async pull(controller) {
          signal.throwIfAborted();
          if (offset >= end) {
            controller.close();
            return;
          }
          const chunkStart = offset - (offset % file.chunkSize);
          let chunk = chunks.get(chunkStart);
          if (chunk) {
            chunks.delete(chunkStart);
          } else {
            const stream = share.openFile(file, {
              start: chunkStart,
              end: Math.min(chunkStart + file.chunkSize, file.size),
              signal,
            });
            chunk = new Response(stream).arrayBuffer().then((data) => new Uint8Array(data));
            const pending = chunk;
            void chunk.catch(() => {
              if (chunks.get(chunkStart) === pending) chunks.delete(chunkStart);
            });
          }
          chunks.set(chunkStart, chunk);
          if (chunks.size > 2) {
            const oldest = chunks.keys().next().value;
            if (oldest !== undefined) chunks.delete(oldest);
          }
          const data = await chunk;
          if (cancelled) return;
          signal.throwIfAborted();
          const next = Math.min(end, chunkStart + data.byteLength);
          controller.enqueue(data.subarray(offset - chunkStart, next - chunkStart));
          offset = next;
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
  };
}

async function mediaController(): Promise<ServiceWorker> {
  const workers = navigator.serviceWorker;
  await workers.register("/share-media-worker.js");
  if (workers.controller?.scriptURL === new URL("/share-media-worker.js", location.href).href) {
    return workers.controller;
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      workers.removeEventListener("controllerchange", changed);
      reject(new Error("Streaming is unavailable"));
    }, 8_000);
    function changed(): void {
      const controller = workers.controller;
      if (controller?.scriptURL !== new URL("/share-media-worker.js", location.href).href) return;
      clearTimeout(timeout);
      workers.removeEventListener("controllerchange", changed);
      resolve(controller);
    }
    workers.addEventListener("controllerchange", changed);
    changed();
  });
}

export function StreamedMedia({
  share,
  file,
  kind,
  name,
}: {
  share: UnlockedShare;
  file: ManifestFile;
  kind: "audio" | "video";
  name: string;
}): React.JSX.Element {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    const id = crypto.randomUUID();
    const workers = navigator.serviceWorker;
    if (!workers) {
      setFailed(true);
      return;
    }
    const type = safeMediaType(kind, file.path, file.mime);
    const openRange = mediaReader(share, file, abort.signal);
    function serve(event: MessageEvent): void {
      if (
        event.source !== workers.controller ||
        event.data?.type !== "share-media-range" ||
        event.data.id !== id ||
        !event.ports[0]
      )
        return;
      const port = event.ports[0];
      const range = mediaRange(event.data.range, file.size);
      if (!range) {
        port.postMessage({ status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
        port.close();
        return;
      }
      const [start, end] = range;
      const headers: Record<string, string> = {
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start),
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      };
      const partial = event.data.range !== null;
      if (partial) headers["Content-Range"] = `bytes ${start}-${end - 1}/${file.size}`;
      const body = openRange(start, end);
      try {
        port.postMessage({ status: partial ? 206 : 200, headers, body }, [body]);
      } catch {
        void body.cancel();
        port.postMessage({ status: 503 });
      } finally {
        port.close();
      }
    }
    workers.addEventListener("message", serve);
    void mediaController()
      .then(() => {
        if (!abort.signal.aborted) setUrl(`/.share-media/${id}`);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });
    return () => {
      abort.abort();
      workers.removeEventListener("message", serve);
    };
  }, [share, file, kind]);

  if (failed)
    return (
      <div className="content-state">Streaming is unavailable. Use Download to save this file.</div>
    );
  if (!url)
    return (
      <div className="content-state" role="status">
        Preparing streaming preview…
      </div>
    );
  return <MediaPlayer url={url} kind={kind} name={name} />;
}
