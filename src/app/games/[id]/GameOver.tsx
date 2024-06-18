"use client";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export default function GameOver({ gameId }: { gameId: string }) {
  const router = useRouter();
  const handleClone = async () => {
    const res = await fetch(`/games/clone/${gameId}`, {});

    if (!res.ok) {
      console.error("Failed to clone game");
      throw new Error("Failed to clone game");
    }
    const { newGameId } = await res.json();
    console.log("new game", newGameId);
    router.push(`/games/${newGameId}`);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <h2 className="flex justify-center">Game over</h2>
      <Button onClick={handleClone}>Play again</Button>
      <p className="text-xs">
        This will start a new game with the same players
      </p>
    </div>
  );
}
