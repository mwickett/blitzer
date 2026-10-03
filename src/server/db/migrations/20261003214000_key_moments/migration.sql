-- CreateTable
CREATE TABLE "KeyMoment" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "round_id" TEXT,
    "uploader_id" TEXT,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "caption" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyMoment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeyMoment_game_id_created_at_idx" ON "KeyMoment"("game_id", "created_at");

-- CreateIndex
CREATE INDEX "KeyMoment_round_id_idx" ON "KeyMoment"("round_id");

-- CreateIndex
CREATE INDEX "KeyMoment_uploader_id_idx" ON "KeyMoment"("uploader_id");

-- AddForeignKey
ALTER TABLE "KeyMoment" ADD CONSTRAINT "KeyMoment_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyMoment" ADD CONSTRAINT "KeyMoment_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyMoment" ADD CONSTRAINT "KeyMoment_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
