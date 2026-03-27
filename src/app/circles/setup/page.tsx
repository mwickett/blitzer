import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/server/db/db";
import { Prisma } from "@/generated/prisma/client";
import CircleSetup from "./CircleSetup";

export default async function CircleSetupPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // DO NOT redirect if orgId is set. The user may have just created
  // or joined a circle and needs to complete the friend migration step.

  // Get accepted friends for migration step.
  // Uses a raw SQL query instead of prisma.friend.findMany() because
  // the Friend model will be removed from the Prisma schema in Task 13.
  // Raw SQL still works against the table as long as it exists, and
  // returns an empty array (not a compile error) after the table is dropped.
  let friends: { id: string; username: string; email: string }[] = [];
  try {
    const prismaUser = await prisma.user.findUnique({
      where: { clerk_user_id: userId },
      select: { id: true },
    });

    if (prismaUser) {
      friends = await prisma.$queryRaw<
        { id: string; username: string; email: string }[]
      >(Prisma.sql`
        SELECT u.id, u.username, u.email
        FROM "User" u
        INNER JOIN "Friend" f
          ON (f."user1Id" = ${prismaUser.id} AND f."user2Id" = u.id)
          OR (f."user2Id" = ${prismaUser.id} AND f."user1Id" = u.id)
      `);
    }
  } catch {
    // Friend table may have been dropped — skip friend migration
  }

  return (
    <main className="container mx-auto p-4 max-w-lg py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Welcome to Circles</h1>
        <p className="text-muted-foreground">
          Circles are groups of players you play Dutch Blitz with — your family,
          game night crew, or coworkers. You need at least one to get started.
        </p>
      </div>
      <CircleSetup friends={friends} hasCircle={!!orgId} />
    </main>
  );
}
