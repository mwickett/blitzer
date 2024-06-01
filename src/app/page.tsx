import Link from "next/link";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-6 justify-around bg-brand">
      <Image
        src="/img/blitzer-logo.png"
        width={400}
        height={400}
        alt="Blitzer logo - line drawing windmill with hearts"
      />
      <SignedIn>
        <Link href="/app">
          <Button>Go to Dashboard</Button>
        </Link>
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
