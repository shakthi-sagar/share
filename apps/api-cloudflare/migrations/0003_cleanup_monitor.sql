CREATE TABLE cleanup_monitor (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  scheduled_at INTEGER NOT NULL,
  succeeded INTEGER CHECK (succeeded IN (0, 1))
);

-- Give the new Worker one scheduling window to record its first result.
INSERT INTO cleanup_monitor (id, scheduled_at, succeeded) VALUES (1, unixepoch() * 1000, NULL);
