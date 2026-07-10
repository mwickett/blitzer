"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Play } from "lucide-react";
import { startPickupGame } from "@/server/mutations/lobbies";
import { Button } from "@/components/ui/button";

interface LobbyControlsProps {
  gameId: string;
  joinUrl: string;
  isHost: boolean;
  canStart: boolean;
}

export function LobbyControls({
  gameId,
  joinUrl,
  isHost,
  canStart,
}: LobbyControlsProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refreshWhenVisible, 5_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router]);

  const copy = async () => {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  };

  const startGame = () => {
    startTransition(async () => {
      try {
        await startPickupGame(gameId);
        router.push(`/games/${gameId}`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to start");
      }
    });
  };

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" className="w-full" onClick={copy}>
        {copied ? (
          <Check className="mr-2 h-4 w-4" />
        ) : (
          <Copy className="mr-2 h-4 w-4" />
        )}
        {copied ? "Copied" : "Copy join link"}
      </Button>

      {isHost ? (
        <Button
          className="w-full"
          disabled={!canStart || pending}
          onClick={startGame}
        >
          <Play className="mr-2 h-4 w-4" />
          {pending
            ? "Starting…"
            : canStart
              ? "Start game"
              : "Waiting for another player"}
        </Button>
      ) : (
        <p className="rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
          Waiting for the host to start the game…
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
