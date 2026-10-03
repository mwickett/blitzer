-- CreateTable
CREATE TABLE "GameStory" (
    "game_id" TEXT NOT NULL,
    "story" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "source_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameStory_pkey" PRIMARY KEY ("game_id")
);

-- AddForeignKey
ALTER TABLE "GameStory" ADD CONSTRAINT "GameStory_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
