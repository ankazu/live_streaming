-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'broadcaster', 'viewer');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'pending', 'suspended');

-- CreateEnum
CREATE TYPE "StreamStatus" AS ENUM ('scheduled', 'live', 'ended');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "account_status" "AccountStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streams" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "StreamStatus" NOT NULL DEFAULT 'scheduled',
    "broadcaster_id" UUID NOT NULL,
    "viewer_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "streams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "streams_status_idx" ON "streams"("status");

-- CreateIndex
CREATE INDEX "streams_broadcaster_id_idx" ON "streams"("broadcaster_id");

-- AddForeignKey
ALTER TABLE "streams" ADD CONSTRAINT "streams_broadcaster_id_fkey" FOREIGN KEY ("broadcaster_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
