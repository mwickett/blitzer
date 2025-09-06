"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function GameOver({
  gameId,
  winner,
}: {
  gameId: string;
  winner: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const handleClone = async () => {
    const res = await fetch(`/games/clone/${gameId}`, {});

    if (!res.ok) {
      console.error("Failed to clone game");
      throw new Error("Failed to clone game");
    }
    const { newGameId } = await res.json();
    router.push(`/games/${newGameId}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            🎉 {winner} won the game!
          </DialogTitle>
          <DialogDescription className="text-center">
            Great round — want a rematch with the same players?
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-col items-center gap-3">
          <Button size="lg" onClick={handleClone} className="w-full">
            Play again
          </Button>
          <p className="text-xs text-muted-foreground">
            Starts a new game with the same players
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
