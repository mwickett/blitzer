import Link from "next/link";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-6 justify-around">
      <h1>Blitz Keeper 🏗️</h1>
      <SignedIn>
        <Link href="/app">Go to Dashboard</Link>
      </SignedIn>
      <SignedOut>
        <SignInButton />
      </SignedOut>
      <p>
        This is a major WIP. The goal is to create an app that makes scoring
        Dutch Blitz games easy, and also allows you to see cool stats about your
        performance as a player.
      </p>
    </main>
  );
}
