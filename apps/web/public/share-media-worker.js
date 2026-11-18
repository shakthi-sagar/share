// Media bodies live in the tab. This worker forwards only requests from the media element's client.
globalThis.addEventListener("install", (event) => event.waitUntil(globalThis.skipWaiting()));
globalThis.addEventListener("activate", (event) => event.waitUntil(globalThis.clients.claim()));

globalThis.addEventListener("fetch", (event) => {
  const { request, clientId } = event;
  const path = new URL(request.url);
  if (path.origin !== globalThis.location.origin || !path.pathname.startsWith("/.share-media/"))
    return;
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
