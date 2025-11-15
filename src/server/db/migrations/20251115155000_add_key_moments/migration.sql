-- CreateTable
CREATE TABLE "KeyMoment" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundId" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyMoment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeyMoment_gameId_idx" ON "KeyMoment"("gameId");

-- CreateIndex
CREATE INDEX "KeyMoment_roundId_idx" ON "KeyMoment"("roundId");

-- CreateIndex
CREATE INDEX "KeyMoment_uploadedByUserId_idx" ON "KeyMoment"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "KeyMoment" ADD CONSTRAINT "KeyMoment_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyMoment" ADD CONSTRAINT "KeyMoment_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyMoment" ADD CONSTRAINT "KeyMoment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
