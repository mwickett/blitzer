"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import prisma from "@/server/db/db";
import NewGameChooser from "./newGameChooser";

export default async function NewGamePage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    return <div>Please sign in</div>;
  }

  if (!orgId) {
    return <div>Please join a circle first</div>;
  }

  // Get circle members from Clerk
  const client = await clerkClient();
  const memberships = await client.organizations.getOrganizationMembershipList({
    organizationId: orgId,
  });

  // Extract Clerk user IDs from memberships
  const clerkUserIds = memberships.data
    .map((m) => m.publicUserData?.userId)
    .filter((id): id is string => !!id);

  // Look up Prisma users by their clerk_user_ids
  const users = await prisma.user.findMany({
    where: {
      clerk_user_id: { in: clerkUserIds },
    },
    select: {
      id: true,
      username: true,
      clerk_user_id: true,
      avatarUrl: true,
    },
  });

  return (
    <main className="container mx-auto p-4">
      <NewGameChooser users={users} />
    </main>
  );
}
