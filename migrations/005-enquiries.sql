ALTER TABLE contact_enquiries ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE contact_enquiries ADD COLUMN IF NOT EXISTS assignee_id text REFERENCES "user"(id);
ALTER TABLE contact_enquiries ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS contact_messages(id text PRIMARY KEY,enquiry_id text NOT NULL REFERENCES contact_enquiries(id),body text NOT NULL,author_id text NOT NULL REFERENCES "user"(id),author_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS contact_messages_enquiry ON contact_messages(enquiry_id,created_at);
