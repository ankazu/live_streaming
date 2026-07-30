-- Normalize legacy one-to-one rows before removing the temporary stream mode model.
UPDATE "streams"
SET "mode" = 'broadcast'
WHERE "mode" = 'one_to_one';

ALTER TABLE "streams"
  ALTER COLUMN "mode" DROP DEFAULT,
  DROP COLUMN "mode";

DROP TYPE "StreamMode";
