"use server";

import { auth } from "@clerk/nextjs/server";
import NewGameChooser from "./newGameChooser";
import { getOrgMembers } from "@/server/queries";

export default async function NewGamePage() {
  const { userId } = await auth();

  if (!userId) {
    return <div>Please sign in</div>;
  }

  const users = await getOrgMembers();

  return (
    <main className="container mx-auto p-4">
      <NewGameChooser users={users} />
    </main>
  );
}
