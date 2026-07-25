"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinPickupGameByCode } from "@/server/mutations/lobbies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JoinByCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          try {
            const result = await joinPickupGameByCode(code);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            router.push(`/games/${result.gameId}/lobby`);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to join");
          }
        });
      }}
      className="space-y-4"
    >
      <Input
        autoCapitalize="characters"
        autoComplete="off"
        maxLength={6}
        placeholder="Lobby code"
        value={code}
        onChange={(event) =>
          setCode(
            event.target.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 6),
          )
        }
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="w-full" disabled={pending || code.length !== 6}>
        {pending ? "Joining…" : "Join game"}
      </Button>
    </form>
  );
}
