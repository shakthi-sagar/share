import { shareIdSchema, tokenSchema } from "@share/protocol";

const storagePrefix = "share:delete:";

/**
 * A share this browser published. The delete token is the only authority that can remove the share
 * early, and it is issued once, at publish time, so it is kept here until the share expires.
 */
export type PublishedShare = {
  id: string;
  deleteToken: string;
  createdAt: string | null;
  expiresAt: string | null;
};

export function shareStorageKey(id: string): string {
  return `${storagePrefix}${id}`;
}

export function rememberPublishedShare(share: {
  id: string;
  deleteToken: string;
  expiresAt: string | null;
  createdAt?: string;
}): void {
  const record: PublishedShare = {
    id: share.id,
    deleteToken: share.deleteToken,
    createdAt: share.createdAt ?? new Date().toISOString(),
    expiresAt: share.expiresAt,
  };
  try {
    localStorage.setItem(shareStorageKey(record.id), JSON.stringify(record));
  } catch {
    // A full or unavailable store must not fail publishing; the share still works.
  }
}

export function forgetPublishedShare(id: string): void {
  try {
    localStorage.removeItem(shareStorageKey(id));
  } catch {
    // Nothing to do: the record is a convenience, not a source of truth.
  }
}

export function listPublishedShares(): PublishedShare[] {
  const shares: PublishedShare[] = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(storagePrefix)) {
        continue;
      }
      const value = localStorage.getItem(key);
      if (value) {
        const share = parsePublishedShare(key.slice(storagePrefix.length), value);
        if (share) {
          shares.push(share);
        }
      }
    }
  } catch {
    return shares;
  }
  return shares.sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
}

/**
 * Accepts both the stored record and the earlier bare-token entries, so a share published before
 * this format existed can still be revoked from this browser.
 */
function parsePublishedShare(id: string, value: string): PublishedShare | null {
  if (!shareIdSchema.safeParse(id).success) {
    return null;
  }
  if (tokenSchema.safeParse(value).success) {
    return { id, deleteToken: value, createdAt: null, expiresAt: null };
  }
  const parsed: unknown = parseJson(value);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const record = (parsed ?? {}) as Partial<PublishedShare>;
  const storedId = shareIdSchema.safeParse(record.id);
  const storedToken = tokenSchema.safeParse(record.deleteToken);
  if (!storedId.success || !storedToken.success || storedId.data !== id) {
    return null;
  }
  return {
    id,
    deleteToken: storedToken.data,
    createdAt: isoOrNull(record.createdAt),
    expiresAt: isoOrNull(record.expiresAt),
  };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isoOrNull(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}
