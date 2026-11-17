ALTER TABLE orders ADD COLUMN request_key text UNIQUE;
ALTER TABLE orders ADD COLUMN request_fingerprint text;
ALTER TABLE orders ADD COLUMN checkout_url text;
