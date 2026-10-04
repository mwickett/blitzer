import "server-only";

import prisma from "@/server/db/db";

/** The viewer's score entry preference; "cards" when unknown. */
export async function getScoreEntryMode(
  clerkUserId: string,
): Promise<"cards" | "total"> {
  const user = await prisma.user.findUnique({
    where: { clerk_user_id: clerkUserId },
    select: { scoreEntryMode: true },
  });
  return user?.scoreEntryMode === "TOTAL" ? "total" : "cards";
}
