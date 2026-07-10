CREATE TYPE "GameKind" AS ENUM ('CIRCLE', 'PICKUP', 'LEGACY');

ALTER TABLE "Game"
ADD COLUMN "kind" "GameKind" NOT NULL DEFAULT 'CIRCLE',
ADD COLUMN "started_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "host_user_id" TEXT,
ADD COLUMN "join_token" TEXT,
ADD COLUMN "join_code" TEXT;

UPDATE "Game"
SET "kind" = 'LEGACY'
WHERE "organization_id" IS NULL;

CREATE UNIQUE INDEX "Game_join_token_key" ON "Game"("join_token");
CREATE UNIQUE INDEX "Game_join_code_key" ON "Game"("join_code");
CREATE INDEX "Game_host_user_id_idx" ON "Game"("host_user_id");
CREATE INDEX "Game_kind_started_at_idx" ON "Game"("kind", "started_at");

ALTER TABLE "Game"
ADD CONSTRAINT "Game_host_user_id_fkey"
FOREIGN KEY ("host_user_id") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
