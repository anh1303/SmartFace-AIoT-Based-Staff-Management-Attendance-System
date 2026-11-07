CREATE TABLE fingerprint_templates (
 id UUID PRIMARY KEY, employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
 device_id TEXT NOT NULL, revision INTEGER NOT NULL, finger_name TEXT NOT NULL,
 ciphertext BYTEA NOT NULL, checksum VARCHAR(64) NOT NULL, match_score INTEGER NOT NULL,
 sensor_model TEXT NOT NULL DEFAULT 'ZA620_M5', status TEXT NOT NULL DEFAULT 'PENDING',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(employee_id,revision), CHECK(status IN ('PENDING','ACTIVE','REVOKED')),
 CHECK(revision > 0 AND match_score BETWEEN 0 AND 65535)
);
CREATE UNIQUE INDEX fingerprint_one_active_employee ON fingerprint_templates(employee_id) WHERE status='ACTIVE';
CREATE TABLE fingerprint_bindings (
 id UUID PRIMARY KEY, template_id UUID NOT NULL UNIQUE REFERENCES fingerprint_templates(id) ON DELETE CASCADE,
 device_id TEXT NOT NULL, slot INTEGER NOT NULL CHECK(slot >= 0), state TEXT NOT NULL DEFAULT 'PENDING',
 error TEXT, synced_at TIMESTAMPTZ,
 UNIQUE(device_id,slot), CHECK(state IN ('PENDING','SYNCED','REVOKED'))
);
CREATE TABLE fingerprint_sessions (
 id UUID PRIMARY KEY, employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
 owner_id UUID NOT NULL, device_id TEXT NOT NULL, finger_name TEXT NOT NULL,
 key UUID NOT NULL, confirm_key UUID, status TEXT NOT NULL DEFAULT 'QUEUED',
 match_score INTEGER, ciphertext BYTEA, checksum TEXT, template_id UUID,
 error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL,
 UNIQUE(owner_id,key), CHECK(status IN ('QUEUED','WAITING_TOUCH_1','LIFT_FINGER','WAITING_TOUCH_2','VERIFIED','SYNCING','COMPLETED','FAILED','CANCELLED','EXPIRED'))
);
CREATE UNIQUE INDEX fingerprint_one_session_device ON fingerprint_sessions(device_id)
 WHERE status IN ('QUEUED','WAITING_TOUCH_1','LIFT_FINGER','WAITING_TOUCH_2','VERIFIED','SYNCING');
CREATE UNIQUE INDEX fingerprint_one_session_employee ON fingerprint_sessions(employee_id)
 WHERE status IN ('QUEUED','WAITING_TOUCH_1','LIFT_FINGER','WAITING_TOUCH_2','VERIFIED','SYNCING');
CREATE TABLE fingerprint_devices (
 device_id TEXT PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 65535),
 ready BOOLEAN NOT NULL DEFAULT false, roundtrip_verified BOOLEAN NOT NULL DEFAULT false,
 wak_verified BOOLEAN NOT NULL DEFAULT false, attendance_enabled BOOLEAN NOT NULL DEFAULT false,
 polling_fallback BOOLEAN NOT NULL DEFAULT false, last_seen TIMESTAMPTZ NOT NULL DEFAULT now(), error TEXT
);
