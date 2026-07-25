-- The column was added with DEFAULT CURRENT_TIMESTAMP, so every pre-existing
-- game claims it started at the moment 20260710120000_add_pickup_games ran.
-- Point them back at their real creation time.
--
-- This is a separate migration rather than an edit to the one that added the
-- column: that one may already be applied, and changing an applied migration
-- fails `prisma migrate deploy` on a checksum mismatch.
UPDATE "Game"
SET "started_at" = "created_at"
WHERE "kind" <> 'PICKUP';
