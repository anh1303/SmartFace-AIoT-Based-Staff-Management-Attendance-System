ALTER TABLE employee_shifts ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE TABLE background_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL, label VARCHAR(200) NOT NULL,
  idempotency_key UUID NOT NULL, input_hash VARCHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  payload JSONB NOT NULL DEFAULT '{}', result JSONB, error TEXT,
  total INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0,
  succeeded INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1, attempts INTEGER NOT NULL DEFAULT 0,
  lease_token UUID, lease_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, idempotency_key)
);
CREATE INDEX background_operations_poll ON background_operations(status, lease_until, created_at);
CREATE INDEX background_operations_owner ON background_operations(owner_id, created_at DESC);
CREATE TABLE background_operation_inputs (
  operation_id UUID PRIMARY KEY REFERENCES background_operations(id) ON DELETE CASCADE,
  ciphertext BYTEA NOT NULL, expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours'
);
CREATE TABLE background_operation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES background_operations(id) ON DELETE CASCADE,
  item_key VARCHAR(150) NOT NULL, payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued', error TEXT,
  UNIQUE(operation_id, item_key)
);
CREATE TABLE face_enrollment_receipts (
  operation_id UUID PRIMARY KEY REFERENCES background_operations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  result JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
