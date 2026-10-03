-- CreateEnum
CREATE TYPE "ScoreEntryMode" AS ENUM ('CARDS', 'TOTAL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "score_entry_mode" "ScoreEntryMode" NOT NULL DEFAULT 'CARDS';

-- AlterTable
ALTER TABLE "Score" ALTER COLUMN "totalCardsPlayed" DROP NOT NULL,
ALTER COLUMN "blitzPileRemaining" DROP NOT NULL,
ADD COLUMN     "typed_score" INTEGER;

-- A score is either a card breakdown or a typed total, never both or neither.
ALTER TABLE "Score" ADD CONSTRAINT "Score_breakdown_or_typed_score" CHECK (
  ("typed_score" IS NULL AND "totalCardsPlayed" IS NOT NULL AND "blitzPileRemaining" IS NOT NULL)
  OR ("typed_score" IS NOT NULL AND "totalCardsPlayed" IS NULL AND "blitzPileRemaining" IS NULL)
);
