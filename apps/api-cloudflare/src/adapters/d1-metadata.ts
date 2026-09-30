import type { CompleteShareRequest } from "@share/protocol";
import type { MetadataStore, ShareRecord, UploadLimits, UploadReservation } from "@share/server";

interface ShareRow {
  id: string;
  state: "uploading" | "ready";
  format_version: number;
  upload_token_hash: string;
  delete_token_hash: string;
  access_credential_hash: string | null;
  object_count: number;
  chunk_count: number;
  ciphertext_bytes: number;
  reserved_bytes: number;
  reserved_chunks: number;
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
}

export class D1MetadataStore implements MetadataStore {
  constructor(private readonly database: D1Database) {}

  async create(record: ShareRecord): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO shares (
          id, state, format_version, upload_token_hash, delete_token_hash,
          access_credential_hash, object_count, chunk_count, ciphertext_bytes,
          reserved_bytes, reserved_chunks, created_at, completed_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        record.id,
        record.state,
        record.formatVersion,
        record.uploadTokenHash,
        record.deleteTokenHash,
        record.accessCredentialHash,
        record.objectCount,
        record.chunkCount,
        record.ciphertextBytes,
        record.reservedBytes,
        record.reservedChunks,
        record.createdAt,
        record.completedAt,
        record.expiresAt,
      )
      .run();
  }

  async find(id: string): Promise<ShareRecord | null> {
    const row = await this.database
      .prepare("SELECT * FROM shares WHERE id = ?")
      .bind(id)
      .first<ShareRow>();
    return row ? mapShare(row) : null;
  }

  async complete(
    id: string,
    completion: CompleteShareRequest,
    completedAt: string,
  ): Promise<boolean> {
    const result = await this.database
      .prepare(
        `UPDATE shares SET
          state = 'ready', access_credential_hash = ?, object_count = ?, chunk_count = ?,
          ciphertext_bytes = ?, completed_at = ?
        WHERE id = ? AND state = 'uploading'`,
      )
      .bind(
        completion.accessCredentialHash,
        completion.objectCount,
        completion.chunkCount,
        completion.ciphertextBytes,
        completedAt,
        id,
      )
      .run();
    return result.meta.changes === 1;
  }

  async reserve(
    id: string,
    reservation: UploadReservation,
    limits: UploadLimits,
  ): Promise<boolean> {
    // One conditional UPDATE is the check and the increment, so concurrent uploads cannot overshoot.
    const result = await this.database
      .prepare(
        `UPDATE shares SET
          reserved_bytes = reserved_bytes + ?1, reserved_chunks = reserved_chunks + ?2
        WHERE id = ?3 AND state = 'uploading'
          AND reserved_bytes + ?1 <= ?4 AND reserved_chunks + ?2 <= ?5`,
      )
      .bind(reservation.bytes, reservation.chunks, id, limits.maxBytes, limits.maxChunks)
      .run();
    return result.meta.changes === 1;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.database.prepare("DELETE FROM shares WHERE id = ?").bind(id).run();
    return result.meta.changes === 1;
  }

  async listPurgeable(
    expiredAt: string,
    abandonedBefore: string,
    limit: number,
  ): Promise<string[]> {
    // Each branch uses its own partial index: shares_expiry_idx and shares_uploading_idx.
    const result = await this.database
      .prepare(
        `SELECT id FROM (
           SELECT id, created_at FROM shares WHERE expires_at IS NOT NULL AND expires_at <= ?1
           UNION
           SELECT id, created_at FROM shares WHERE state = 'uploading' AND created_at <= ?2
         )
         ORDER BY created_at ASC
         LIMIT ?3`,
      )
      .bind(expiredAt, abandonedBefore, limit)
      .all<{ id: string }>();
    return result.results.map((row) => row.id);
  }
}

function mapShare(row: ShareRow): ShareRecord {
  return {
    id: row.id,
    state: row.state,
    formatVersion: row.format_version,
    uploadTokenHash: row.upload_token_hash,
    deleteTokenHash: row.delete_token_hash,
    accessCredentialHash: row.access_credential_hash,
    objectCount: row.object_count,
    chunkCount: row.chunk_count,
    ciphertextBytes: row.ciphertext_bytes,
    reservedBytes: row.reserved_bytes,
    reservedChunks: row.reserved_chunks,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
  };
}
