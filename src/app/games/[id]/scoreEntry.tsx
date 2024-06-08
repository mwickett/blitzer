"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createScoresForGame } from "@/server/mutations";
import { GameWithPlayersAndScores } from "./page";
import { Player } from "./page";

interface PlayerTouched extends Player {
  touched: {
    blitzPileRemaining: boolean;
    totalCardsPlayed: boolean;
  };
}

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
      touched: {
        blitzPileRemaining: false,
        totalCardsPlayed: false,
      },
    }))
  );

  const [scoresValid, setScoresValid] = useState(false);

  // Utility function to remove leading zeros
  const stripLeadingZeros = (value: string) => {
    return value.replace(/^0+(?=\d)/, "");
  };

  const handleBlitzPileChange = (userId: string, value: string) => {
    const strippedValue = stripLeadingZeros(value);
    const intValue = parseInt(strippedValue, 10);

    const min = 0;
    const max = 10;
    setPlayerScores((prevScores: PlayerTouched[]) =>
      prevScores.map((player) =>
        player.userId === userId
          ? {
              ...player,
              blitzPileRemaining:
                !isNaN(intValue) && intValue >= min && intValue <= max
                  ? intValue
                  : 0,
              touched: { ...player.touched, blitzPileRemaining: true },
            }
          : player
      )
    );
    validateScores();
  };

  const handleTotalCardsChange = (userId: string, value: string) => {
    const strippedValue = stripLeadingZeros(value);
    const intValue = parseInt(strippedValue, 10);

    const min = 0;
    const max = 40;
    setPlayerScores((prevScores: PlayerTouched[]) =>
      prevScores.map((player) =>
        player.userId === userId
          ? {
              ...player,
              totalCardsPlayed:
                !isNaN(intValue) && intValue >= min && intValue <= max
                  ? intValue
                  : 0,
              touched: { ...player.touched, totalCardsPlayed: true },
            }
          : player
      )
    );
    validateScores();
  };

  const handleBlitzPileBlur = (userId: string) => {
    setPlayerScores((prevScores: PlayerTouched[]) =>
      prevScores.map((player) =>
        player.userId === userId
          ? {
              ...player,
              blitzPileRemaining:
                parseInt(
                  stripLeadingZeros(player.blitzPileRemaining.toString()),
                  10
                ) || 0,
              touched: { ...player.touched, blitzPileRemaining: true },
            }
          : player
      )
    );
  };

  const handleTotalCardsBlur = (userId: string) => {
    setPlayerScores((prevScores: PlayerTouched[]) =>
      prevScores.map((player) =>
        player.userId === userId
          ? {
              ...player,
              totalCardsPlayed:
                parseInt(
                  stripLeadingZeros(player.totalCardsPlayed.toString()),
                  10
                ) || 0,
              touched: { ...player.touched, totalCardsPlayed: true },
            }
          : player
      )
    );
  };

  const handleSubmit = async () => {
    await createScoresForGame(game.id, playerScores);
    // reset form state
    setPlayerScores((prevScores: PlayerTouched[]) =>
      prevScores.map((player) => ({
        ...player,
        blitzPileRemaining: 0,
        totalCardsPlayed: 0,
        touched: {
          blitzPileRemaining: false,
          totalCardsPlayed: false,
        },
      }))
    );
    setScoresValid(false);
  };

  const validateScores = () => {
    const allFieldsTouched = playerScores.every(
      (player) =>
        player.touched.blitzPileRemaining && player.touched.totalCardsPlayed
    );
    const atLeastOneBlitzed = playerScores.some(
      (player) => player.blitzPileRemaining === 0
    );

    const isValid = allFieldsTouched && atLeastOneBlitzed;

    setScoresValid(isValid);
  };

  // useEffect to validate scores when playerScores state changes
  useEffect(() => {
    validateScores();
  }, [playerScores]);

  return (
    <form className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Scores</h1>
      <div className="grid gap-4">
        <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2">
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
              value={playerScore.blitzPileRemaining.toString()}
              onChange={(e) =>
                handleBlitzPileChange(playerScore.userId, e.target.value)
              }
              onBlur={() => handleBlitzPileBlur(playerScore.userId)}
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
              value={playerScore.totalCardsPlayed.toString()}
              onChange={(e) =>
                handleTotalCardsChange(playerScore.userId, e.target.value)
              }
              onBlur={() => handleTotalCardsBlur(playerScore.userId)}
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
