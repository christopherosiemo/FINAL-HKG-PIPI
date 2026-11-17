ALTER TABLE "member" ADD CONSTRAINT member_customer_role_check CHECK(role IN ('owner','approver','member','viewer','billing'));
