"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/server/db/db";
import posthogClient from "@/app/posthog";

/**
 * Helper function to get authenticated user and posthog client
 * @throws {Error} If user is not authenticated
 */
export async function getAuthenticatedUser() {
  const user = await auth();
  const posthog = posthogClient();

  if (!user.userId) throw new Error("Unauthorized");

  return { user, posthog };
}

/**
 * Helper function to get authenticated user's internal Prisma ID
 * @throws {Error} If user is not authenticated or not found
 */
export async function getAuthenticatedUserPrismaId() {
  const { user, posthog } = await getAuthenticatedUser();

  const prismaUser = await prisma.user.findUnique({
    where: { clerk_user_id: user.userId },
    select: { id: true },
  });

  if (!prismaUser) throw new Error("User not found");

  return { userId: user.userId, id: prismaUser.id, posthog };
}
