// Media bodies live in the tab. This worker forwards only requests from the media element's client.
globalThis.addEventListener("install", (event) => event.waitUntil(globalThis.skipWaiting()));
globalThis.addEventListener("activate", (event) => event.waitUntil(globalThis.clients.claim()));

const downloads = new Map();

globalThis.addEventListener("message", (event) => {
  const { source, data } = event;
  if (
    source?.type !== "window" ||
    new URL(source.url).origin !== globalThis.location.origin ||
    data?.type !== "share-register-download" ||
    !/^[\da-f-]{36}$/u.test(data.id) ||
    typeof data.filename !== "string" ||
    !Number.isSafeInteger(data.size) ||
    data.size < 0 ||
    !(data.stream instanceof ReadableStream) ||
    downloads.has(data.id)
  )
    return;
  const timer = setTimeout(() => {
    downloads.delete(data.id);
    void data.stream.cancel().catch(() => {});
  }, 15_000);
  downloads.set(data.id, { ...data, timer, client: source.id });
  event.ports[0]?.postMessage(true);
  event.ports[0]?.close();
});

globalThis.addEventListener("fetch", (event) => {
  const { request, clientId } = event;
  const path = new URL(request.url);
  if (path.origin !== globalThis.location.origin) return;
  if (path.pathname.startsWith("/.share-download/")) {
    const id = path.pathname.slice("/.share-download/".length);
    const download = downloads.get(id);
    // Download navigations may omit clientId. In that case the one-time URL is the credential.
    if (!download || request.method !== "GET" || (clientId && download.client !== clientId)) {
      event.respondWith(new Response(null, { status: 404 }));
      return;
    }
    downloads.delete(id);
    clearTimeout(download.timer);
    const filename = encodeURIComponent(download.filename.toWellFormed()).replace(
      /['()*]/gu,
      (character) => `%${character.charCodeAt(0).toString(16)}`,
    );
    event.respondWith(
      new Response(download.stream, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
          "Content-Length": String(download.size),
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }),
    );
    return;
  }
  if (!path.pathname.startsWith("/.share-media/")) return;
  const id = path.pathname.slice("/.share-media/".length);
  if (!clientId || request.method !== "GET" || !["audio", "video"].includes(request.destination)) {
    event.respondWith(new Response(null, { status: 404 }));
    return;
  }
  event.respondWith(requestMedia(clientId, id, request.headers.get("Range")));
});

async function requestMedia(clientId, id, range) {
  const client = await globalThis.clients.get(clientId);
  if (!client) return new Response(null, { status: 404 });
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      resolve(new Response(null, { status: 504 }));
    }, 10_000);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(new Response(data.body ?? null, { status: data.status, headers: data.headers }));
    };
    client.postMessage({ type: "share-media-range", id, range }, [channel.port2]);
  });
}
