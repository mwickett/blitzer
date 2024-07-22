/*
  Warnings:

  - You are about to drop the column `roundsId` on the `Score` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Score" DROP CONSTRAINT "Score_roundsId_fkey";

-- AlterTable
ALTER TABLE "Score" DROP COLUMN "roundsId",
ADD COLUMN     "roundId" TEXT;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;
