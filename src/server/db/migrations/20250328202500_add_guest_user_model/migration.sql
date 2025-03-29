-- CreateTable
CREATE TABLE "GuestUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "invitationSent" BOOLEAN NOT NULL DEFAULT false,
    "invitationSentAt" TIMESTAMP(3),
    "emailSent" TEXT,

    CONSTRAINT "GuestUser_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "GamePlayers" ADD COLUMN "guestId" TEXT,
                         ADD COLUMN "id" TEXT NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "Score" ADD COLUMN "guestId" TEXT;

-- CreateIndex
CREATE INDEX "GuestUser_createdById_idx" ON "GuestUser"("createdById");

-- CreateIndex
CREATE INDEX "GamePlayers_guestId_idx" ON "GamePlayers"("guestId");

-- CreateIndex
CREATE INDEX "Score_guestId_idx" ON "Score"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayers_gameId_userId_idx" ON "GamePlayers"("gameId", "userId") WHERE "userId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayers_gameId_guestId_idx" ON "GamePlayers"("gameId", "guestId") WHERE "guestId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "GuestUser" ADD CONSTRAINT "GuestUser_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayers" ADD CONSTRAINT "GamePlayers_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
