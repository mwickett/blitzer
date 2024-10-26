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
      <div className="flex flex-col m-8 text-center">
        <h3 className="pb-4">🏗️ This project is a work in progress.</h3>
        <p className="pb-4">
          Currently you can score a game of{" "}
          <a href="https://www.dutchblitz.com">Dutch Blitz</a>, but more
          features are coming. The idea is to create a stats tool for people who
          are <i>really</i> into Dutch Blitz.
        </p>
        <p className="">
          You can{" "}
          <a
            className="underline"
            href="https://wickett.notion.site/Vision-for-Blitzer-a802db0123d54ef6881598c67cd4a147?pvs=4"
          >
            read more about the vision and future plans for this project.
          </a>
        </p>
      </div>
    </main>
  );
}
