import { describe, expect, it } from "vitest";
import { fixedSizeChunks } from "../src";

describe("fixedSizeChunks", () => {
  it("reframes arbitrary stream boundaries without losing bytes", async () => {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.of(1, 2));
        controller.enqueue(Uint8Array.of(3, 4, 5, 6, 7));
        controller.close();
      },
    });
    const chunks: number[][] = [];
    for await (const chunk of fixedSizeChunks(source, 3)) {
      chunks.push([...chunk]);
    }
    expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });
});
