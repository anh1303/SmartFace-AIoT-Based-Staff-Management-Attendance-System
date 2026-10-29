ALTER TABLE employees ADD COLUMN hourly_rate_history JSONB NOT NULL DEFAULT '[]'::jsonb;
