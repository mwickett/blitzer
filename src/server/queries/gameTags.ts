import "server-only";

import prisma from "@/server/db/db";

const SUGGESTION_LIMIT = 8;

/**
 * Recent distinct tags to suggest when tagging a game: tags from the game's
 * Circle, or from games the viewer played. Bounded and optional.
 */
export async function getTagSuggestions(
  clerkUserId: string,
  organizationId: string | null,
): Promise<string[]> {
  try {
    const rows = await prisma.game.findMany({
      where: {
        tag: { not: null },
        OR: [
          ...(organizationId ? [{ organizationId }] : []),
          { players: { some: { user: { clerk_user_id: clerkUserId } } } },
        ],
      },
      distinct: ["tag"],
      select: { tag: true },
      orderBy: { createdAt: "desc" },
      take: SUGGESTION_LIMIT,
    });
    return rows.flatMap((row) => (row.tag ? [row.tag] : []));
  } catch {
    // Suggestions are a convenience; tagging works without them.
    return [];
  }
}
