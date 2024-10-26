"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createRoundForGame } from "@/server/mutations";
import { GameWithPlayersAndScores, DisplayScores } from "@/lib/gameLogic";
import { z } from "zod";
import { useRouter } from "next/navigation";
import GameOver from "./GameOver";

const playerScoreSchema = z.object({
  userId: z.string(),
  username: z.string(),
  roundNumber: z.number().min(1),
  blitzPileRemaining: z.number().min(0).max(10),
  totalCardsPlayed: z.number().min(0).max(40),
  touched: z.object({
    totalCardsPlayed: z.boolean(),
  }),
});

const scoresSchema = z.array(playerScoreSchema);

export default function ScoreEntry({
  game,
  currentRoundNumber,
  displayScores,
}: {
  game: GameWithPlayersAndScores;
  currentRoundNumber: number;
  displayScores: DisplayScores[];
}) {
  const router = useRouter();
  const [playerScores, setPlayerScores] = useState(
    game.players.map((player) => ({
      userId: player.user.id,
      username: player.user.username,
      roundNumber: currentRoundNumber,
      blitzPileRemaining: 0,
      totalCardsPlayed: 0,
      touched: {
        totalCardsPlayed: false,
      },
    }))
  );
  const [scoresValid, setScoresValid] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const winner = displayScores.find((score) => score.isWinner);

  const validateScores = useCallback(() => {
    try {
      scoresSchema.parse(playerScores);
      const allFieldsTouched = playerScores.every(
        (player) => player.touched.totalCardsPlayed
      );
      const atLeastOneBlitzed = playerScores.some(
        (player) => player.blitzPileRemaining === 0
      );

      setScoresValid(allFieldsTouched && atLeastOneBlitzed);
    } catch (e) {
      const validationErrors: { [key: string]: string } = {};
      if (e instanceof z.ZodError) {
        e.errors.forEach((error) => {
          validationErrors[error.path.join(".")] = error.message;
        });
      }
      setErrors(validationErrors);
      setScoresValid(false);
    }
  }, [playerScores]);

  useEffect(() => {
    validateScores();
  }, [playerScores, validateScores]);

  if (winner) {
    return <GameOver gameId={game.id} winner={winner.username} />;
  }

  const stripLeadingZeros = (value: string) => {
    return value.replace(/^0+(?=\d)/, "");
  };

  const handleBlitzPileChange = (userId: string, value: string) => {
    const strippedValue = stripLeadingZeros(value);
    const intValue = parseInt(strippedValue, 10);

    setPlayerScores((prevScores) =>
      prevScores.map((player) =>
        player.userId === userId
          ? {
              ...player,
              blitzPileRemaining:
                !isNaN(intValue) && intValue >= 0 && intValue <= 10
                  ? intValue
                  : 0,
            }
          : player
      )
    );
    validateScores();
  };

  const handleTotalCardsChange = (userId: string, value: string) => {
    const strippedValue = stripLeadingZeros(value);
    const intValue = parseInt(strippedValue, 10);

    setPlayerScores((prevScores) =>
      prevScores.map((player) =>
        player.userId === userId
          ? {
              ...player,
              totalCardsPlayed:
                !isNaN(intValue) && intValue >= 0 && intValue <= 40
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
    setPlayerScores((prevScores) =>
      prevScores.map((player) =>
        player.userId === userId
          ? {
              ...player,
              blitzPileRemaining:
                parseInt(
                  stripLeadingZeros(player.blitzPileRemaining.toString()),
                  10
                ) || 0,
            }
          : player
      )
    );
  };

  const handleTotalCardsBlur = (userId: string) => {
    setPlayerScores((prevScores) =>
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createRoundForGame(game.id, currentRoundNumber, playerScores);
      setPlayerScores((prevScores) =>
        prevScores.map((player) => ({
          ...player,
          blitzPileRemaining: 0,
          totalCardsPlayed: 0,
          touched: {
            totalCardsPlayed: false,
          },
        }))
      );
      setScoresValid(false);
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <form
      className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-6 max-w-md mx-auto"
      onSubmit={handleSubmit}
    >
      <h1 className="text-2xl font-bold mb-6">
        Round {currentRoundNumber} Scores
      </h1>
      <div className="grid gap-4">
        <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2">
          <p>Player</p>
          <p>Blitz pile left</p>
          <p>Cards played</p>
        </div>
        {playerScores.map((playerScore) => (
          <div
            className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2"
            key={playerScore.userId}
          >
            <Label htmlFor={playerScore.userId}>{playerScore.username}</Label>
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
              id={`cards-${playerScore.userId}`}
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
        <Button type="submit" disabled={!scoresValid}>
          Save Scores
        </Button>
      </div>
    </form>
  );
}
