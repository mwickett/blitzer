"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Game } from "@prisma/client";
import { User } from "@prisma/client";

import createScoresForGame from "./newScoreAction";

interface Player {
  userId: string;
  email: string;
  blitzPileRemaining: number;
  totalCardsPlayed: number;
}

interface GameWithPlayers extends Game {
  players: { user: User }[];
}

export function ScoreEntry({ game }: { game: GameWithPlayers }) {
  console.log(game);
  const [playerScores, setPlayerScores] = useState(
    game.players.map((player) => ({
      userId: player.user.id,
      email: player.user.email || "",
      blitzPileRemaining: 0,
      totalCardsPlayed: 0,
    }))
  );

  const handleBlitzPileChange = (userId: string, value: number) => {
    setPlayerScores((prevScores: Player[]) =>
      prevScores.map((player) =>
        player.userId === userId
          ? { ...player, blitzPileRemaining: value }
          : player
      )
    );
  };

  const handleTotalCardsChange = (userId: string, value: number) => {
    setPlayerScores((prevScores: Player[]) =>
      prevScores.map((player) =>
        player.userId === userId
          ? { ...player, totalCardsPlayed: value }
          : player
      )
    );
  };

  const handleSubmit = async () => {
    await createScoresForGame(game.id, playerScores);
  };

  return (
    <div className="bg-white dark:bg-gray-950 rounded-lg shadow-sm p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dutch Blitz Scores</h1>
      <div className="grid gap-4">
        {playerScores.map((playerScore: Player) => (
          <div
            className="grid grid-cols-[1fr_2fr_1fr] items-center gap-2"
            key={playerScore.userId}
          >
            <Label htmlFor={playerScore.userId}>{playerScore.email}</Label>
            <Input
              id={playerScore.userId}
              placeholder="Blitz Cards"
              type="number"
              value={playerScore.blitzPileRemaining}
              onChange={(e) =>
                handleBlitzPileChange(
                  playerScore.userId,
                  parseInt(e.target.value, 10) || 0
                )
              }
            />
            <Input
              id="player1-cards"
              placeholder="Total cards"
              type="number"
              value={playerScore.totalCardsPlayed}
              onChange={(e) =>
                handleTotalCardsChange(
                  playerScore.userId,
                  parseInt(e.target.value, 10) || 0
                )
              }
            />
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="submit" onClick={handleSubmit}>
          Save Scores
        </Button>
      </div>
    </div>
  );
}
