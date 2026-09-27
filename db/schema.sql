CREATE TABLE IF NOT EXISTS paddle_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  entitled BOOLEAN NOT NULL DEFAULT FALSE,
  price_id TEXT,
  product_id TEXT,
  installation_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  scheduled_change JSONB,
  custom_data JSONB,
  last_event_id TEXT NOT NULL,
  event_occurred_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paddle_subscriptions_customer_id
  ON paddle_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_paddle_subscriptions_installation_id
  ON paddle_subscriptions(installation_id);
CREATE INDEX IF NOT EXISTS idx_paddle_subscriptions_status
  ON paddle_subscriptions(status);
