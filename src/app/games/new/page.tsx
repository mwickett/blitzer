"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/server/db/db";
import type { User } from "@prisma/client";
import NewGameChooser from "./newGameChooser";
import { isClerkOrgsEnabled } from "@/featureFlags";
import { getOrgMembers } from "@/server/queries";

export default async function NewGamePage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    return <div>Please sign in</div>;
  }

  const useOrgs = await isClerkOrgsEnabled();

  if (useOrgs && !orgId) {
    return (
      <main className="container mx-auto p-4">
        <div className="p-4 rounded border bg-muted/20 text-sm">
          Select a group using the organization switcher to start a game.
        </div>
      </main>
    );
  }

  let users: Pick<User, "id" | "username" | "clerk_user_id" | "avatarUrl">[] = [];
  if (useOrgs) {
    users = await getOrgMembers();
  } else {
    users = await prisma.user.findMany({
      where: {
        NOT: {
          clerk_user_id: "",
        },
      },
      select: {
        id: true,
        username: true,
        clerk_user_id: true,
        avatarUrl: true,
      },
    });
  }

  return (
    <main className="container mx-auto p-4">
      <NewGameChooser users={users} />
    </main>
  );
}
