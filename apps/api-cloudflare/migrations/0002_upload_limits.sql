-- Server-side upload accounting, so a share cannot store more than the configured limit, and an
-- index for finding uploads that were abandoned before completion.
ALTER TABLE shares ADD COLUMN reserved_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shares ADD COLUMN reserved_chunks INTEGER NOT NULL DEFAULT 0;

CREATE INDEX shares_uploading_idx ON shares (created_at) WHERE state = 'uploading';
