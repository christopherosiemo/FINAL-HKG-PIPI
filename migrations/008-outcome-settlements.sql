ALTER TABLE orders DROP CONSTRAINT orders_offer_check;
ALTER TABLE orders ADD CONSTRAINT orders_offer_check CHECK(offer IN ('savings-sprint','implementation','outcome'));
DROP INDEX orders_active_proposal;
CREATE UNIQUE INDEX orders_active_proposal ON orders(proposal_id) WHERE status IN ('pending','paid','partial_refunded','disputed','refunded');
