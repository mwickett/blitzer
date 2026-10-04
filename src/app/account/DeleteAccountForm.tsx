"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteMyAccount } from "@/server/mutations/account";

export default function DeleteAccountForm() {
  const { signOut } = useClerk();
  const [anonymize, setAnonymize] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await deleteMyAccount({ anonymize }).catch(() => ({
      ok: false as const,
      message: "We couldn't delete your account. Please try again.",
    }));
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }
    // The login is already gone; this clears the browser's session.
    await signOut({ redirectUrl: "/" });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={anonymize}
          onChange={(event) => setAnonymize(event.target.checked)}
        />
        <span>
          Also remove my name and photo. Past games will show me as
          &ldquo;Former player&rdquo;.
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>I understand this can&apos;t be undone.</span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" variant="destructive" disabled={!confirmed || pending}>
        {pending ? "Deleting…" : "Delete my account"}
      </Button>
    </form>
  );
}
