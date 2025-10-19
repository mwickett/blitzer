-- Add organizationId to Game (nullable for legacy data)
ALTER TABLE "Game" ADD COLUMN "organizationId" TEXT;

-- Index for fast org queries
CREATE INDEX IF NOT EXISTS "Game_organizationId_idx" ON "Game"("organizationId");

-- Create OrganizationMembership
CREATE TABLE "OrganizationMembership" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT,
  CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique membership per org/user
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");

-- Helper indexes
CREATE INDEX "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId");
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");