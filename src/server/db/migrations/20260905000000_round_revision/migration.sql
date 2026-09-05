-- Existing rounds start at revision zero. Edits advance this under the game lock.
ALTER TABLE "Round" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
