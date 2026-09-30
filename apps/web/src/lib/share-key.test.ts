import { describe, expect, it } from "vitest";
import { keyFromInput } from "./share-key";

describe("keyFromInput", () => {
  it("reads the key from a pasted full link", () => {
    expect(keyFromInput(" https://share.example/s/AAAAAAAAAAAAAAAAAAAAAA#k=abc_DEF-123 ")).toBe(
      "abc_DEF-123",
    );
    expect(keyFromInput("https://share.example/s/id#x=1&k=key")).toBe("key");
  });

  it("returns a bare key unchanged apart from whitespace", () => {
    expect(keyFromInput("  abc_DEF-123\n")).toBe("abc_DEF-123");
  });
});
