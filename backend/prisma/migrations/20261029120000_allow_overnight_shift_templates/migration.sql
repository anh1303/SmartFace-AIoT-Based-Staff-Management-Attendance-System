ALTER TABLE shift_templates DROP CONSTRAINT shift_templates_valid_times;
ALTER TABLE shift_templates ADD CONSTRAINT shift_templates_valid_times CHECK (
  start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND
  end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND start_time <> end_time
);
