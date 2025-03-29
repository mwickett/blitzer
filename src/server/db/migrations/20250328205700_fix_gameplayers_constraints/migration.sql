-- This migration specifically alters constraints on the GamePlayers table
-- to ensure that either userId or guestId can be null (but not both)

-- First drop any existing constraints that might be causing the issue
ALTER TABLE "GamePlayers" DROP CONSTRAINT IF EXISTS "GamePlayers_pkey";

-- Re-create the primary key using the id field (which should always be non-null)
ALTER TABLE "GamePlayers" ADD PRIMARY KEY ("id");

-- Make sure userId is properly defined as nullable
ALTER TABLE "GamePlayers" ALTER COLUMN "userId" DROP NOT NULL;

-- Make sure guestId is properly defined as nullable
ALTER TABLE "GamePlayers" ALTER COLUMN "guestId" DROP NOT NULL;

-- Add a check constraint to ensure at least one of userId or guestId is not null
ALTER TABLE "GamePlayers" ADD CONSTRAINT "GamePlayers_user_or_guest_check" 
    CHECK (("userId" IS NOT NULL) OR ("guestId" IS NOT NULL));

-- Recreate the unique constraints for user ID and game ID pairings
DROP INDEX IF EXISTS "gamePlayer_userId";
DROP INDEX IF EXISTS "gamePlayer_guestId";

CREATE UNIQUE INDEX "gamePlayer_userId" ON "GamePlayers"("gameId", "userId") 
    WHERE "userId" IS NOT NULL;

CREATE UNIQUE INDEX "gamePlayer_guestId" ON "GamePlayers"("gameId", "guestId") 
    WHERE "guestId" IS NOT NULL;
