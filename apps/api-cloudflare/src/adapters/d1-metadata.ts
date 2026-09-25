import type { CompleteShareRequest } from "@share/protocol";
import type { MetadataStore, ShareRecord } from "@share/server";

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
          created_at, completed_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  async remove(id: string): Promise<boolean> {
    const result = await this.database.prepare("DELETE FROM shares WHERE id = ?").bind(id).run();
    return result.meta.changes === 1;
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
    createdAt: row.created_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
  };
}
