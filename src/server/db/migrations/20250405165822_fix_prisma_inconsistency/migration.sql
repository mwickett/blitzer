/*
  Warnings:

  - A unique constraint covering the columns `[gameId,userId]` on the table `GamePlayers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[gameId,guestId]` on the table `GamePlayers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[gameId,round]` on the table `Round` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "GamePlayers" DROP CONSTRAINT "GamePlayers_userId_fkey";

-- DropForeignKey
ALTER TABLE "Score" DROP CONSTRAINT "Score_userId_fkey";

-- AlterTable
ALTER TABLE "GamePlayers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Score" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "GamePlayers_userId_idx" ON "GamePlayers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "game_players_game_id_user_id" ON "GamePlayers"("gameId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "game_players_game_id_guest_id" ON "GamePlayers"("gameId", "guestId");

-- CreateIndex
CREATE UNIQUE INDEX "Round_gameId_round_key" ON "Round"("gameId", "round");

-- CreateIndex
CREATE INDEX "Score_userId_idx" ON "Score"("userId");

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayers" ADD CONSTRAINT "GamePlayers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
