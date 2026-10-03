import prisma from "@/server/db/db";

/** The signed-in player's personal story style, or null when unset. */
export async function getStoryPromptForClerkUser(clerkUserId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { clerk_user_id: clerkUserId },
    select: { storyPrompt: true },
  });
  return user?.storyPrompt ?? null;
}
