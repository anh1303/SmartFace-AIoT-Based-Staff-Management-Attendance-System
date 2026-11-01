CREATE TABLE webhook_alert_dedup (
  event_key CHAR(64) PRIMARY KEY,
  kind VARCHAR(20) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX webhook_alert_dedup_expires_at_idx ON webhook_alert_dedup(expires_at);
