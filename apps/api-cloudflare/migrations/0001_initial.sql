CREATE TABLE shares (
  id TEXT PRIMARY KEY NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('uploading', 'ready')),
  format_version INTEGER NOT NULL,
  upload_token_hash TEXT NOT NULL,
  delete_token_hash TEXT NOT NULL,
  access_credential_hash TEXT,
  object_count INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  ciphertext_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  expires_at TEXT
);

CREATE INDEX shares_expiry_idx ON shares (expires_at) WHERE expires_at IS NOT NULL;

