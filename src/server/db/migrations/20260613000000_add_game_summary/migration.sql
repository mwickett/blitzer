-- CreateEnum
CREATE TYPE "GameSummaryStatus" AS ENUM ('pending', 'ready', 'failed', 'insufficient_data');

-- CreateTable
CREATE TABLE "GameSummary" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "audience_user_id" TEXT,
    "status" "GameSummaryStatus" NOT NULL DEFAULT 'pending',
    "content" TEXT,
    "model" TEXT,
    "prompt_version" TEXT NOT NULL,
    "source_stats_hash" TEXT NOT NULL,
    "source_updated_at" TIMESTAMP(3) NOT NULL,
    "tokens_used" INTEGER,
    "error" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameSummary_status_idx" ON "GameSummary"("status");

-- CreateIndex
CREATE INDEX "GameSummary_game_id_idx" ON "GameSummary"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "GameSummary_game_id_prompt_version_key" ON "GameSummary"("game_id", "prompt_version");

-- AddForeignKey
ALTER TABLE "GameSummary" ADD CONSTRAINT "GameSummary_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
