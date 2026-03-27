-- AlterTable: Add organization_id to Game
-- Note: The production DB has an "organizationId" column from a prior migration.
-- We drop it and add the snake_case version to match Prisma conventions.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Game' AND column_name = 'organizationId') THEN
    DROP INDEX IF EXISTS "Game_organizationId_idx";
    ALTER TABLE "Game" DROP COLUMN "organizationId";
  END IF;
END $$;

ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

-- AlterTable: Add organization_id to GuestUser
ALTER TABLE "GuestUser" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Game_organization_id_idx" ON "Game"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GuestUser_organization_id_idx" ON "GuestUser"("organization_id");
