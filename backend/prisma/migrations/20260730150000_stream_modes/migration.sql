CREATE TYPE "StreamMode" AS ENUM ('broadcast', 'one_to_one');

ALTER TABLE "streams"
  ADD COLUMN "mode" "StreamMode" NOT NULL DEFAULT 'broadcast';
