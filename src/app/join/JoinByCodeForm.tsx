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
            const { gameId } = await joinPickupGameByCode(code);
            router.push(`/games/${gameId}/lobby`);
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
        maxLength={8}
        placeholder="Lobby code"
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="w-full" disabled={pending || code.length < 4}>
        {pending ? "Joining…" : "Join game"}
      </Button>
    </form>
  );
}
