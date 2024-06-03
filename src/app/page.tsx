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
        This is a major WIP. All you can do right now is make a new game and
        keep track of scores. Nothing else works, yet! Get started by signing in
        or making an account, then go to Games to start a new game.
      </p>
    </main>
  );
}
