ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK(status IN ('pending','paid','expired','failed','cancelled','refunded','partial_refunded','disputed'));
ALTER TABLE orders ADD COLUMN last_reconciled_at timestamptz;
ALTER TABLE orders ADD COLUMN reconciliation_error text;
ALTER TABLE payment_events ADD COLUMN detail jsonb NOT NULL DEFAULT '{}';
CREATE TABLE payment_reconciliations (id text PRIMARY KEY,order_id text NOT NULL REFERENCES orders(id),actor_id text NOT NULL,status text NOT NULL,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
