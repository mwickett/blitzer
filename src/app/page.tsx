import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
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
        <Link href="/dashboard">
          <Button>Go to Dashboard</Button>
        </Link>
      </SignedIn>
      <SignedOut>
        <div className="flex gap-2">
          <Button>
            <SignInButton />
          </Button>
          <Button>
            <SignUpButton>Sign up</SignUpButton>
          </Button>
        </div>
      </SignedOut>
      <p className="text-center">
        🏗️ This project is a work in progress. Currently you can score a game of
        Dutch Blitz, but more features are coming. The idea is to create a stats
        tool for people who are <i>really</i> into{" "}
        <a href="https://dutchblitz.com/">Dutch Blitz</a>. Note: all players are
        currently global, meaning that when you sign-up, your email address will
        be visible to other users. Adding a friends mechanism is high on the
        list
      </p>
    </main>
  );
}
