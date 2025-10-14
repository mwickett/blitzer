-- CreateTable
CREATE TABLE "GameOrganization" (
    "gameId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "GameOrganization_pkey" PRIMARY KEY ("gameId","organizationId")
);

-- CreateIndex
CREATE INDEX "GameOrganization_organizationId_idx" ON "GameOrganization"("organizationId");

-- AddForeignKey
ALTER TABLE "GameOrganization" ADD CONSTRAINT "GameOrganization_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameOrganization" ADD CONSTRAINT "GameOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "GameOrganization" ("gameId", "organizationId")
SELECT g."id", g."organizationId"
FROM "Game" g
WHERE g."organizationId" IS NOT NULL
ON CONFLICT ("gameId","organizationId") DO NOTHING;
