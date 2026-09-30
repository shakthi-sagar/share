import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetPublishedShare,
  listPublishedShares,
  rememberPublishedShare,
  shareStorageKey,
} from "./published-shares";

const id = "AAAAAAAAAAAAAAAAAAAAAA";
const otherId = "BBBBBBBBBBBBBBBBBBBBBB";
const token = "a".repeat(43);
const otherToken = "b".repeat(43);

// The suite runs in the node environment, so browser storage is a minimal in-memory stand-in.
function installLocalStorage(): void {
  const entries = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    get length() {
      return entries.size;
    },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
    clear: () => entries.clear(),
  });
}

installLocalStorage();

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("published share records", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and lists a published share newest first", () => {
    rememberPublishedShare({
      id,
      deleteToken: token,
      expiresAt: "2026-10-01T00:00:00.000Z",
      createdAt: "2026-09-25T00:00:00.000Z",
    });
    rememberPublishedShare({
      id: otherId,
      deleteToken: otherToken,
      expiresAt: null,
      createdAt: "2026-09-26T00:00:00.000Z",
    });

    expect(listPublishedShares().map((share) => share.id)).toEqual([otherId, id]);
  });

  it("keeps the local snapshot name and file count with the record", () => {
    rememberPublishedShare({
      id,
      deleteToken: token,
      expiresAt: null,
      name: "Notes",
      fileCount: 3,
    });
    expect(listPublishedShares()[0]).toMatchObject({ name: "Notes", fileCount: 3 });

    localStorage.setItem(
      shareStorageKey(otherId),
      JSON.stringify({ id: otherId, deleteToken: otherToken, name: 7, fileCount: -1 }),
    );
    expect(listPublishedShares().find((share) => share.id === otherId)).toMatchObject({
      name: null,
      fileCount: null,
    });
  });

  it("removes a record once the share is revoked", () => {
    rememberPublishedShare({ id, deleteToken: token, expiresAt: null });
    expect(listPublishedShares()).toHaveLength(1);

    forgetPublishedShare(id);
    expect(listPublishedShares()).toEqual([]);
    expect(localStorage.getItem(shareStorageKey(id))).toBeNull();
  });

  it("still reads entries stored as a bare token", () => {
    localStorage.setItem(shareStorageKey(id), token);
    expect(listPublishedShares()).toEqual([
      { id, deleteToken: token, name: null, fileCount: null, createdAt: null, expiresAt: null },
    ]);
  });

  it("ignores entries that are not a valid id and token pair", () => {
    localStorage.setItem(shareStorageKey(id), JSON.stringify({ id, deleteToken: "short" }));
    localStorage.setItem(shareStorageKey(otherId), "{not json");
    localStorage.setItem("share:delete:", token);
    localStorage.setItem("unrelated-key", token);

    expect(listPublishedShares()).toEqual([]);
  });

  it("ignores share records with an unparsable timestamp", () => {
    localStorage.setItem(
      shareStorageKey(id),
      JSON.stringify({ id, deleteToken: token, createdAt: "yesterday", expiresAt: null }),
    );
    expect(listPublishedShares()).toEqual([
      { id, deleteToken: token, name: null, fileCount: null, createdAt: null, expiresAt: null },
    ]);
  });
});
