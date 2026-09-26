import { sharePrefix } from "./paths";
import { requireDeleteAuthorization } from "./share-service";
import type { BlobStore, MetadataStore } from "./types";

/** Ids listed per metadata query. Keeps each D1 statement small. */
export const EXPIRED_BATCH_SIZE = 200;

/** Upper bound on shares removed by one sweep, so a large backlog drains over several runs. */
export const EXPIRED_SWEEP_LIMIT = 2000;

export type PurgeResult = {
  /** Expired ids examined during the sweep. */
  scanned: number;
  /** Shares whose ciphertext and metadata row are both gone. */
  removed: number;
  /** Shares that were skipped because their objects could not be removed. */
  failed: number;
  /** True when the sweep stopped at the limit with expired shares possibly still queued. */
  truncated: boolean;
};

export type PurgeOptions = {
  batchSize?: number;
  limit?: number;
  onError?: (shareId: string, error: unknown) => void;
};

/**
 * Deletes a share and its ciphertext after the delete token is verified. Objects go first so a
 * failure leaves the metadata row in place rather than an unreadable row without data.
 */
export async function deleteShare(
  metadata: MetadataStore,
  blobs: BlobStore,
  id: string,
  deleteToken: string | null,
): Promise<void> {
  await requireDeleteAuthorization(metadata, id, deleteToken);
  await blobs.removePrefix(sharePrefix(id));
  await metadata.remove(id);
}

/**
 * Removes the ciphertext and metadata of shares whose expiry has passed. Authorization already
 * refuses these shares, so this reclaims storage rather than revoking access.
 *
 * Each share is handled independently: a failure is reported and the metadata row stays, so the
 * next sweep retries it instead of orphaning ciphertext that nothing points to.
 */
export async function purgeExpiredShares(
  metadata: MetadataStore,
  blobs: BlobStore,
  now = new Date(),
  options: PurgeOptions = {},
): Promise<PurgeResult> {
  const batchSize = clampBatch(options.batchSize ?? EXPIRED_BATCH_SIZE);
  const limit = Math.max(options.limit ?? EXPIRED_SWEEP_LIMIT, 0);
  const expiredAt = now.toISOString();
  const result: PurgeResult = { scanned: 0, removed: 0, failed: 0, truncated: false };
  if (limit === 0) {
    return result;
  }

  while (result.scanned < limit) {
    const pageSize = Math.min(batchSize, limit - result.scanned);
    const ids = await metadata.listExpired(expiredAt, pageSize);
    if (ids.length === 0) {
      return result;
    }
    result.scanned += ids.length;

    for (const id of ids) {
      try {
        await blobs.removePrefix(sharePrefix(id));
        await metadata.remove(id);
        result.removed += 1;
      } catch (error) {
        result.failed += 1;
        options.onError?.(id, error);
      }
    }

    if (ids.length < pageSize) {
      return result;
    }
  }
  result.truncated = true;
  return result;
}

function clampBatch(value: number): number {
  if (!Number.isFinite(value)) {
    return EXPIRED_BATCH_SIZE;
  }
  return Math.min(Math.max(Math.trunc(value), 1), EXPIRED_BATCH_SIZE);
}
