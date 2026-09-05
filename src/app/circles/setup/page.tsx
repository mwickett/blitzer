import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import CircleSetup from "./CircleSetup";

export default async function CircleSetupPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }
  if (orgId) {
    redirect("/dashboard");
  }

  return (
    <main className="container mx-auto p-4 max-w-lg py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Welcome to Circles</h1>
        <p className="text-muted-foreground">
          Circles are groups of players you play Dutch Blitz with — your family,
          game night crew, or coworkers. They keep a regular group together so
          you can start a game without sharing a code. For a one-off game, you
          can skip this and start a pickup game instead.
        </p>
      </div>
      <CircleSetup />
      {!orgId && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Just playing one game?{" "}
          <Link href="/games/new?type=pickup" className="underline">
            Start a pickup game instead
          </Link>
        </p>
      )}
    </main>
  );
}
