-- Merge broadcaster/viewer accounts into the general user role.
CREATE TYPE "UserRole_new" AS ENUM ('admin', 'user');

ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE "role"::text
      WHEN 'admin' THEN 'admin'
      WHEN 'broadcaster' THEN 'user'
      WHEN 'viewer' THEN 'user'
    END
  )::"UserRole_new";

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- Rename the persisted stream ownership field and its database objects.
ALTER TABLE "streams" RENAME COLUMN "broadcaster_id" TO "owner_id";
ALTER INDEX "streams_broadcaster_id_idx" RENAME TO "streams_owner_id_idx";
ALTER TABLE "streams"
  RENAME CONSTRAINT "streams_broadcaster_id_fkey" TO "streams_owner_id_fkey";
