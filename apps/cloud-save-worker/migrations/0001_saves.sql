CREATE TABLE IF NOT EXISTS save_revisions (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  slot_id INTEGER NOT NULL CHECK (slot_id IN (1, 2)),
  kind TEXT NOT NULL CHECK (kind IN ('manual', 'auto')),
  parent_id TEXT,
  saved_at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  byte_size INTEGER NOT NULL,
  payload_json TEXT,
  object_key TEXT,
  CHECK ((payload_json IS NULL) != (object_key IS NULL))
);
CREATE INDEX IF NOT EXISTS save_revisions_owner_slot
  ON save_revisions (owner_email, slot_id, kind, received_at DESC);
CREATE TABLE IF NOT EXISTS save_heads (
  owner_email TEXT NOT NULL,
  slot_id INTEGER NOT NULL CHECK (slot_id IN (1, 2)),
  kind TEXT NOT NULL CHECK (kind IN ('manual', 'auto')),
  revision_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (owner_email, slot_id, kind)
);
