import { decode, decodeImage, toRGBA8 } from "utif2";

const MAX_PIXELS = 40_000_000;

function checkDimensions(width: number, height: number) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > MAX_PIXELS
  ) {
    throw new Error("Image exceeds preview limits");
  }
}

async function decodeHeif(buffer: ArrayBuffer): Promise<ImageData> {
  const { default: libheif } = await import("libheif-js/libheif-wasm/libheif-bundle.mjs");
  const codec = await libheif();
  const decoder = new codec.HeifDecoder();
  const frames = decoder.decode(new Uint8Array(buffer));
  try {
    const frame = frames.find((image) => image.is_primary()) ?? frames[0];
    if (!frame) throw new Error("HEIF image unavailable");
    const width = frame.get_width();
    const height = frame.get_height();
    checkDimensions(width, height);
    const target = new ImageData(width, height);
    return await new Promise<ImageData>((resolve, reject) => {
      frame.display(target, (image) => {
        if (image) resolve(image);
        else reject(new Error("HEIF image could not be decoded"));
      });
    });
  } finally {
    for (const frame of frames) frame.free();
  }
}

function decodeTiff(buffer: ArrayBuffer): ImageData {
  const frame = decode(buffer)[0];
  if (!frame) throw new Error("TIFF image unavailable");
  const width = Number(Array.isArray(frame.t256) ? frame.t256[0] : frame.t256);
  const height = Number(Array.isArray(frame.t257) ? frame.t257[0] : frame.t257);
  checkDimensions(width, height);
  decodeImage(buffer, frame);
  return new ImageData(new Uint8ClampedArray(toRGBA8(frame)), width, height);
}

globalThis.addEventListener(
  "message",
  async (event: MessageEvent<{ blob: Blob; format: string }>) => {
    const { blob, format } = event.data;
    try {
      const buffer = await blob.arrayBuffer();
      const image =
        format === "heic" || format === "heif" ? await decodeHeif(buffer) : decodeTiff(buffer);
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.putImageData(image, 0, 0);
      globalThis.postMessage(await canvas.convertToBlob({ type: "image/png" }));
    } catch {
      globalThis.postMessage(null);
    }
  },
);
