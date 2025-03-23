"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { createRoundForGame } from "@/server/mutations";
import { GameWithPlayersAndScores, DisplayScores } from "@/lib/gameLogic";
import { z } from "zod";
import { useRouter } from "next/navigation";
import GameOver from "./GameOver";

// Basic input validation schema for UX
const playerScoreSchema = z.object({
  userId: z.string(),
  username: z.string(),
  roundNumber: z.number(),
  blitzPileRemaining: z.number(),
  totalCardsPlayed: z.number(),
  touched: z.object({
    totalCardsPlayed: z.boolean(),
  }),
});

function ScoreEntry({
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
  const [error, setError] = useState<string | null>(null);
  const winner = displayScores.find((score) => score.isWinner);

  // Only validate that all fields are filled out
  const validateScores = useCallback(() => {
    try {
      playerScoreSchema.parse(playerScores[0]); // Validate structure
      const allFieldsTouched = playerScores.every(
        (player) => player.touched.totalCardsPlayed
      );
      setScoresValid(allFieldsTouched);
    } catch (e) {
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
    setError(null); // Clear error on input change
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
    setError(null); // Clear error on input change
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
    setError(null); // Clear any previous errors
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
      if (e instanceof Error) {
        setError(e.message);
      } else {
        console.error(e);
        setError("An error occurred while saving scores");
      }
    }
  };

  return (
    <form
      className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-6 max-w-md mx-auto"
      onSubmit={handleSubmit}
    >
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
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

// Wrap with ErrorBoundary and export
export default function ScoreEntryWithErrorBoundary(props: {
  game: GameWithPlayersAndScores;
  currentRoundNumber: number;
  displayScores: DisplayScores[];
}) {
  return (
    <ErrorBoundary
      componentName="ScoreEntry"
      context={{
        gameId: props.game.id,
        roundNumber: props.currentRoundNumber,
        players: props.game.players.length,
        section: "gameplay",
      }}
    >
      <ScoreEntry {...props} />
    </ErrorBoundary>
  );
}
