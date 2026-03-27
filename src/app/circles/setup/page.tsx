import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import CircleSetup from "./CircleSetup";

export default async function CircleSetupPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
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
      <CircleSetup hasCircle={!!orgId} />
    </main>
  );
}
