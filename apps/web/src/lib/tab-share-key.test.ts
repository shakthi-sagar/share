import { describe, expect, it } from "vitest";
import { forgetTabShareKey, readTabShareKey, rememberTabShareKey } from "./tab-share-key";

const shareId = "aBc123_-aBc123_-aBc123";
const key = "a".repeat(43);

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(name) {
      return data.get(name) ?? null;
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(name) {
      data.delete(name);
    },
    setItem(name, value) {
      data.set(name, value);
    },
  };
}

describe("tab-scoped share unlock keys", () => {
  it("reuses an unlocked key on refresh and forgets the key on request", () => {
    const session = memoryStorage();
    rememberTabShareKey(shareId, key, session);
    expect(readTabShareKey(shareId, session)).toBe(key);
    expect(readTabShareKey("b".repeat(22), session)).toBeNull();
    forgetTabShareKey(shareId, session);
    expect(readTabShareKey(shareId, session)).toBeNull();
  });
  it("never stores malformed ids or malformed secrets", () => {
    const session = memoryStorage();
    rememberTabShareKey(shareId, "password", session);
    rememberTabShareKey("../invalid", key, session);
    expect(session.length).toBe(0);
  });
  it("does not break unlocking when session storage is blocked", () => {
    const blocked = {
      getItem() {
        throw Error("blocked");
      },
      setItem() {
        throw Error("blocked");
      },
      removeItem() {
        throw Error("blocked");
      },
    } as unknown as Storage;
    expect(readTabShareKey(shareId, blocked)).toBeNull();
    expect(() => rememberTabShareKey(shareId, key, blocked)).not.toThrow();
    expect(() => forgetTabShareKey(shareId, blocked)).not.toThrow();
  });
});
