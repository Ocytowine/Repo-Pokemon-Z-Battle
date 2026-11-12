CREATE TABLE IF NOT EXISTS mobile_login_codes (
  code_hash TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS mobile_login_codes_expiry ON mobile_login_codes (expires_at);

CREATE TABLE IF NOT EXISTS mobile_sessions (
  token_hash TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS mobile_sessions_owner ON mobile_sessions (owner_email, revoked_at);
