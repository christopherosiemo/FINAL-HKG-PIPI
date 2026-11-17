ALTER TABLE mail_outbox ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX mail_retry_schedule ON mail_outbox(status,next_attempt_at) WHERE status='pending';
