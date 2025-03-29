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
  id: z.string(),
  username: z.string(),
  isGuest: z.boolean().optional(),
  roundNumber: z.number(),
  blitzPileRemaining: z.number(),
  totalCardsPlayed: z.number(),
  touched: z.object({
    totalCardsPlayed: z.boolean(),
  }),
});

// Helper function to get player name
function getPlayerName(
  player: GameWithPlayersAndScores["players"][0] | null | undefined
): string {
  if (!player) return "Unknown Player";

  if (player.user && player.user.username) {
    return player.user.username;
  } else if (player.guestUser && player.guestUser.name) {
    return player.guestUser.name;
  }
  return "Unknown Player";
}

// Helper function to get player ID
function getPlayerId(
  player: GameWithPlayersAndScores["players"][0] | null | undefined
): string {
  if (!player) return `unknown-${Date.now()}`;
  return player.userId || player.guestId || player.id || `temp-${Date.now()}`;
}

// Helper function to check if player is a guest
function isGuestPlayer(
  player: GameWithPlayersAndScores["players"][0] | null | undefined
): boolean {
  if (!player) return false;
  return !!player.guestId;
}

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
      id: getPlayerId(player),
      username: getPlayerName(player),
      isGuest: isGuestPlayer(player),
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

  const handleBlitzPileChange = (playerId: string, value: string) => {
    setError(null); // Clear error on input change
    const strippedValue = stripLeadingZeros(value);
    const intValue = parseInt(strippedValue, 10);

    setPlayerScores((prevScores) =>
      prevScores.map((player) =>
        player.id === playerId
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

  const handleTotalCardsChange = (playerId: string, value: string) => {
    setError(null); // Clear error on input change
    const strippedValue = stripLeadingZeros(value);
    const intValue = parseInt(strippedValue, 10);

    setPlayerScores((prevScores) =>
      prevScores.map((player) =>
        player.id === playerId
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

  const handleBlitzPileBlur = (playerId: string) => {
    setPlayerScores((prevScores) =>
      prevScores.map((player) =>
        player.id === playerId
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

  const handleTotalCardsBlur = (playerId: string) => {
    setPlayerScores((prevScores) =>
      prevScores.map((player) =>
        player.id === playerId
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
      // Convert scores to the format expected by the server
      const scoresToSubmit = playerScores.map((score) => {
        const result: {
          userId?: string;
          guestId?: string;
          blitzPileRemaining: number;
          totalCardsPlayed: number;
        } = {
          blitzPileRemaining: score.blitzPileRemaining,
          totalCardsPlayed: score.totalCardsPlayed,
        };

        // Determine if this is a guest player or not
        if (score.isGuest) {
          result.guestId = score.id;
        } else {
          result.userId = score.id;
        }

        return result;
      });

      await createRoundForGame(game.id, currentRoundNumber, scoresToSubmit);
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
            key={playerScore.id}
          >
            <Label htmlFor={playerScore.id}>
              {playerScore.username}
              {playerScore.isGuest ? " (Guest)" : ""}
            </Label>
            <Input
              id={playerScore.id}
              placeholder="Blitz cards left"
              type="number"
              value={playerScore.blitzPileRemaining.toString()}
              onChange={(e) =>
                handleBlitzPileChange(playerScore.id, e.target.value)
              }
              onBlur={() => handleBlitzPileBlur(playerScore.id)}
              min={0}
              max={10}
              required
              inputMode="numeric"
              pattern="[0-9]*"
            />
            <Input
              id={`cards-${playerScore.id}`}
              placeholder="Total cards"
              type="number"
              value={playerScore.totalCardsPlayed.toString()}
              onChange={(e) =>
                handleTotalCardsChange(playerScore.id, e.target.value)
              }
              onBlur={() => handleTotalCardsBlur(playerScore.id)}
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
