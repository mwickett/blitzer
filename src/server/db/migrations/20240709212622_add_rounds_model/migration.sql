-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "roundsId" TEXT;

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gameId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_roundsId_fkey" FOREIGN KEY ("roundsId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;
