ALTER TABLE orders ADD COLUMN claimed_by text REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN claimed_at timestamptz;
UPDATE orders o SET claimed_by=u.id,claimed_at=now() FROM "user" u WHERE lower(o.email)=lower(u.email) AND o.organisation_id IS NOT NULL AND EXISTS(SELECT 1 FROM "member" m WHERE m."organizationId"=o.organisation_id AND m."userId"=u.id);
