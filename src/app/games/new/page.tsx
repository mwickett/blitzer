"use server";

import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/server/db/db";
import NewGameChooser from "./newGameChooser";
import { getOrgMemberClerkIds } from "@/server/clerkOrgs";

export default async function NewGamePage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    return <div>Please sign in</div>;
  }

  if (!orgId) {
    return <div>Please join a circle first</div>;
  }

  const clerkUserIds = Array.from(await getOrgMemberClerkIds(orgId));

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
      accentColor: true,
    },
  });

  return (
    <main className="container mx-auto p-4">
      <Suspense>
        <NewGameChooser users={users} />
      </Suspense>
    </main>
  );
}
