"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinPickupGame } from "@/server/mutations/lobbies";
import { Button } from "@/components/ui/button";

export function JoinLobbyButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <div className="space-y-3"><Button className="w-full" disabled={pending} onClick={() => startTransition(async () => { try { const { gameId } = await joinPickupGame(token); router.push(`/games/${gameId}/lobby`); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to join"); } })}>{pending ? "Joining…" : "Join this game"}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
