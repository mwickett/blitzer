/*
  Warnings:

  - You are about to drop the column `gameId` on the `Score` table. All the data in the column will be lost.
  - Made the column `roundId` on table `Score` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Score" DROP CONSTRAINT "Score_gameId_fkey";

-- DropForeignKey
ALTER TABLE "Score" DROP CONSTRAINT "Score_roundId_fkey";

-- AlterTable
ALTER TABLE "Score" DROP COLUMN "gameId",
ALTER COLUMN "roundId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Round_gameId_idx" ON "Round"("gameId");

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
