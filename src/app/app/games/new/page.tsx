/**
 * v0 by Vercel.
 * @see https://v0.dev/t/Kll93nmcoZ2
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */

import prisma from "@/db";
import { auth } from "@clerk/nextjs/server";
import NewGameChooser from "./newGameChooser";

export default async function NewGame() {
  const { userId } = auth();

  if (!userId) {
    return (
      <div>
        <h2>You must be logged in to view this page.</h2>
      </div>
    );
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
    },
  });

  if (!users) {
    return (
      <div>
        <h2>No users found.</h2>
      </div>
    );
  }

  return <NewGameChooser users={users} />;
}
