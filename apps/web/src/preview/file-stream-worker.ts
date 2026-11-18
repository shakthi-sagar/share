export async function fileStreamController(): Promise<ServiceWorker> {
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

export async function startBrowserDownload(
  open: () => ReadableStream<Uint8Array>,
  filename: string,
  size: number,
): Promise<boolean> {
  if (!navigator.serviceWorker) return false;
  let worker: ServiceWorker;
  try {
    worker = await fileStreamController();
  } catch {
    return false;
  }
  const channel = new MessageChannel();
  const id = crypto.randomUUID();
  const stream = open();
  const ready = new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => {
      channel.port1.close();
      resolve(false);
    }, 2_000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data === true);
    };
    try {
      worker.postMessage({ type: "share-register-download", id, filename, size, stream }, [
        channel.port2,
        stream,
      ]);
    } catch {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      void stream.cancel().catch(() => {});
      resolve(false);
    }
  });
  if (!(await ready)) return false;
  // A same-origin navigation goes through the service worker. Anchor downloads can bypass it.
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.title = "Share download";
  frame.setAttribute("sandbox", "allow-same-origin allow-downloads");
  frame.src = `/.share-download/${id}`;
  document.body.append(frame);
  window.setTimeout(() => frame.remove(), 120_000);
  return true;
}
