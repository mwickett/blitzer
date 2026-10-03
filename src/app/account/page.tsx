import type { Metadata } from "next";
import { requireSignedIn } from "@/server/pageAuth";
import DeleteAccountForm from "./DeleteAccountForm";

export const metadata: Metadata = { title: "Delete account | Blitzer" };

export default async function AccountPage() {
  await requireSignedIn();

  return (
    <main className="container mx-auto max-w-xl p-5">
      <h1 className="font-display text-2xl font-bold">Delete your account</h1>
      <div className="mt-3 space-y-3 text-sm text-muted-foreground">
        <p>
          Deleting removes your login. You won&apos;t be able to sign in again,
          and nobody can add you to new games.
        </p>
        <p>
          Your scores in past games stay, because the people you played with
          still need their games to add up. Your email is removed either way.
        </p>
      </div>
      <DeleteAccountForm />
    </main>
  );
}
