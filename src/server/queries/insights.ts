import "server-only";

import prisma from "@/server/db/db";
import { PROMPT_VERSION } from "@/lib/insights/summaryPrompt";

// Reads from the PRIMARY: this single indexed row is written in-request at game
// finish, so reading the primary avoids replica lag showing no recap on a
// just-finished game.
export async function getGameSummary(gameId: string) {
  return prisma.gameSummary.findUnique({
    where: { gameId_promptVersion: { gameId, promptVersion: PROMPT_VERSION } },
  });
}
