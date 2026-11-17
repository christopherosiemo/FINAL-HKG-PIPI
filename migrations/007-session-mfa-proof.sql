ALTER TABLE "session" ADD COLUMN mfa_verified_at timestamptz;
-- A successful challenge must not be inferred from clocks on separate hosts.
CREATE OR REPLACE FUNCTION record_mfa_enrollment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."twoFactorEnabled" IS DISTINCT FROM OLD."twoFactorEnabled" THEN
    UPDATE "session" SET mfa_verified_at=NULL WHERE "userId"=NEW.id;
    IF NEW."twoFactorEnabled" THEN NEW.mfa_enrolled_at=clock_timestamp();
    ELSE NEW.mfa_enrolled_at=NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
