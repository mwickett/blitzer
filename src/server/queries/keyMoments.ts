import "server-only";

import prisma from "@/server/db/db";
import { KEY_MOMENT_MAX_PER_GAME, type KeyMomentPhoto } from "@/lib/keyMoments";

/** A game's photos, oldest first, with delete rights resolved for the viewer. */
export async function getKeyMomentsForGame(
  gameId: string,
  viewerClerkId: string | null,
): Promise<KeyMomentPhoto[]> {
  const moments = await prisma.keyMoment.findMany({
    where: { gameId },
    orderBy: { createdAt: "asc" },
    take: KEY_MOMENT_MAX_PER_GAME,
    select: {
      id: true,
      url: true,
      caption: true,
      round: { select: { round: true } },
      uploader: { select: { username: true, clerk_user_id: true } },
    },
  });
  return moments.map((moment) => ({
    id: moment.id,
    url: moment.url,
    caption: moment.caption,
    roundNumber: moment.round?.round ?? null,
    uploaderName: moment.uploader?.username ?? null,
    canDelete: !!viewerClerkId && moment.uploader?.clerk_user_id === viewerClerkId,
  }));
}
