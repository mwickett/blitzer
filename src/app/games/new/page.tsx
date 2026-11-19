import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireSignedIn } from "@/server/pageAuth";
import prisma from "@/server/db/db";
import NewGameChooser from "./newGameChooser";
import { getOrgMemberClerkIds } from "@/server/clerkOrgs";
import { GameTypeChooser } from "./GameTypeChooser";
import { PickupGameSetup } from "./PickupGameSetup";

export const metadata: Metadata = { title: "New game — Blitzer" };

export default async function NewGamePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { orgId } = await requireSignedIn();
  const { type } = await searchParams;

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
      <main className="container mx-auto max-w-md p-4 py-10 text-center">
        <p>Circle games need an active Circle.</p>
        <p className="mt-3 text-sm text-muted-foreground">
          <Link href="/circles/setup" className="font-medium underline">
            Set up a Circle
          </Link>{" "}
          or{" "}
          <Link href="/games/new?type=pickup" className="font-medium underline">
            start a pickup game
          </Link>{" "}
          instead.
        </p>
      </main>
    );

  const clerkUserIds = Array.from(await getOrgMemberClerkIds(orgId));

  // Look up Prisma users by their clerk_user_ids
  const users = await prisma.user.findMany({
    where: {
      clerk_user_id: { in: clerkUserIds },
      deactivatedAt: null,
    },
    select: {
      id: true,
      username: true,
      clerk_user_id: true,
      avatarUrl: true,
      accentColor: true,
      preferredDeck: true,
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
