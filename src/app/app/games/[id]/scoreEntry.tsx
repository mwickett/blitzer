"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import createScoresForGame from "./createScoresForGameAction";

import { GameWithPlayersAndScores } from "./page";
import { Player } from "./page";

export default function ScoreEntry({
  game,
}: {
  game: GameWithPlayersAndScores;
}) {
  const [playerScores, setPlayerScores] = useState(
    game.players.map((player) => ({
      userId: player.user.id,
      email: player.user.email || "",
      blitzPileRemaining: 0,
      totalCardsPlayed: 0,
    }))
  );

  const [scoresValid, setScoresValid] = useState(false);

  // TODO: Abstract this into an input component
  const handleBlitzPileChange = (userId: string, value: number) => {
    const min = 0;
    const max = 10;
    if (Number(value) >= min && Number(value) <= max) {
      setPlayerScores((prevScores: Player[]) =>
        prevScores.map((player) =>
          player.userId === userId
            ? { ...player, blitzPileRemaining: value }
            : player
        )
      );
    }
    validateScores();
  };

  const handleTotalCardsChange = (userId: string, value: number) => {
    const min = 0;
    const max = 40;
    if (Number(value) >= min && Number(value) <= max) {
      setPlayerScores((prevScores: Player[]) =>
        prevScores.map((player) =>
          player.userId === userId
            ? { ...player, totalCardsPlayed: value }
            : player
        )
      );
    }
    validateScores();
  };

  const handleSubmit = async () => {
    await createScoresForGame(game.id, playerScores);
    // reset form state
    setPlayerScores((prevScores: Player[]) =>
      prevScores.map((player) => ({
        ...player,
        blitzPileRemaining: 0,
        totalCardsPlayed: 0,
      }))
    );
    setScoresValid(false);
  };

  const validateScores = () => {
    const isValid = playerScores.every(
      (player) =>
        player.blitzPileRemaining >= 0 &&
        player.blitzPileRemaining <= 10 &&
        player.totalCardsPlayed >= 0 &&
        player.totalCardsPlayed <= 40
    );

    if (isValid) {
      setScoresValid(true);
    } else {
      setScoresValid(false);
    }
  };

  return (
    <form className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Scores</h1>
      <div className="grid gap-4">
        <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 bg-slate-50">
          <p>Player</p>
          <p>Blitz pile left</p>
          <p>Cards played</p>
        </div>
        {playerScores.map((playerScore: Player) => (
          <div
            className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2"
            key={playerScore.userId}
          >
            <Label htmlFor={playerScore.userId}>{playerScore.email}</Label>
            <Input
              id={playerScore.userId}
              placeholder="Blitz cards left"
              type="number"
              value={playerScore.blitzPileRemaining}
              onChange={(e) =>
                handleBlitzPileChange(
                  playerScore.userId,
                  parseInt(e.target.value, 10) || 0
                )
              }
              min={0}
              max={10}
              required
              inputMode="numeric"
              pattern="[0-9]*"
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
              min={0}
              max={40}
              required
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="submit" onClick={handleSubmit} disabled={!scoresValid}>
          Save Scores
        </Button>
      </div>
    </form>
  );
}
