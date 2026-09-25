export async function* fixedSizeChunks(
  stream: ReadableStream<Uint8Array>,
  chunkSize: number,
): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader();
  let pending = new Uint8Array(chunkSize);
  let pendingLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      let offset = 0;
      while (offset < value.byteLength) {
        const copyLength = Math.min(chunkSize - pendingLength, value.byteLength - offset);
        pending.set(value.subarray(offset, offset + copyLength), pendingLength);
        pendingLength += copyLength;
        offset += copyLength;

        if (pendingLength === chunkSize) {
          yield pending;
          pending = new Uint8Array(chunkSize);
          pendingLength = 0;
        }
      }
    }

    if (pendingLength > 0) {
      yield pending.slice(0, pendingLength);
    }
  } finally {
    reader.releaseLock();
  }
}
