"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/server/db/db";
import type { User } from "@prisma/client";
import NewGameChooser from "./newGameChooser";

export default async function NewGamePage() {
  const { userId } = await auth();

  if (!userId) {
    return <div>Please sign in</div>;
  }

  const users = await prisma.user.findMany({
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

  return (
    <main className="container mx-auto p-4">
      <NewGameChooser users={users} />
    </main>
  );
}
