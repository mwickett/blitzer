"use server";

import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/server/db/db";
import NewGameChooser from "./newGameChooser";
import { getOrgMemberClerkIds } from "@/server/clerkOrgs";
import { GameTypeChooser } from "./GameTypeChooser";
import { PickupGameSetup } from "./PickupGameSetup";

export default async function NewGamePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { userId, orgId } = await auth();
  const { type } = await searchParams;

  if (!userId) {
    return <div>Please sign in</div>;
  }

  if (!type)
    return (
      <main className="container mx-auto p-4">
        <GameTypeChooser hasCircle={!!orgId} />
      </main>
    );
  if (type === "pickup")
    return (
      <main className="container mx-auto p-4">
        <PickupGameSetup />
      </main>
    );
  if (type !== "circle")
    return (
      <main className="container mx-auto p-4">
        <GameTypeChooser hasCircle={!!orgId} />
      </main>
    );
  if (!orgId)
    return (
      <main className="container mx-auto p-4 text-center">
        Please join a Circle first.
      </main>
    );

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
