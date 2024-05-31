import Link from "next/link";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-6">
      <h1>Dutch Blitz Scoring 🏗️</h1>
      <SignedIn>
        <Link href="/app">Go to Dashboard</Link>
      </SignedIn>
      <SignedOut>
        <SignInButton />
      </SignedOut>
    </main>
  );
}
