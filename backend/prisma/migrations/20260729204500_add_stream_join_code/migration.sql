-- Add a shareable six-digit code without losing existing stream records.
ALTER TABLE "streams" ADD COLUMN "join_code" TEXT;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "streams") > 900000 THEN
    RAISE EXCEPTION 'Cannot assign unique six-digit join codes to more than 900000 streams';
  END IF;
END $$;

WITH numbered_streams AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS row_number
  FROM "streams"
)
UPDATE "streams"
SET "join_code" = LPAD((99999 + numbered_streams.row_number)::TEXT, 6, '0')
FROM numbered_streams
WHERE "streams"."id" = numbered_streams."id";

ALTER TABLE "streams" ALTER COLUMN "join_code" SET NOT NULL;
CREATE UNIQUE INDEX "streams_join_code_key" ON "streams"("join_code");
