CREATE TABLE IF NOT EXISTS restore_challenges (
  challenge_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  customer_id TEXT,
  subscription_id TEXT,
  email_hash TEXT NOT NULL,
  request_ip_hash TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT restore_challenges_attempts_nonnegative
    CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_restore_challenges_installation_created
  ON restore_challenges(installation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restore_challenges_email_created
  ON restore_challenges(email_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restore_challenges_ip_created
  ON restore_challenges(request_ip_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restore_challenges_expires
  ON restore_challenges(expires_at);
