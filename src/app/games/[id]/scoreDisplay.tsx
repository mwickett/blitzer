"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ScoreLineGraph } from "@/components/ScoreLineGraph";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DisplayScores } from "@/lib/gameLogic";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { validateGameRules, ValidationError } from "@/lib/validation/gameRules";
import { updateRoundScores } from "@/server/mutations";
import { useRouter } from "next/navigation";
import { z } from "zod";

const playerScoreSchema = z.object({
  id: z.string(),
  username: z.string(),
  isGuest: z.boolean().optional(),
  roundNumber: z.number().min(1),
  blitzPileRemaining: z.number().min(0).max(10),
  totalCardsPlayed: z.number().min(0).max(40),
  touched: z.object({
    totalCardsPlayed: z.boolean(),
  }),
});

const scoresSchema = z.array(playerScoreSchema);

function ScoreDisplay({
  displayScores,
  numRounds,
  gameId,
  isFinished,
  showCharts,
}: {
  displayScores: DisplayScores[];
  numRounds: number;
  gameId: string;
  isFinished: boolean;
  showCharts: boolean;
}) {
  const router = useRouter();
  const [editingRound, setEditingRound] = useState<number | null>(null);
  const [editingScores, setEditingScores] = useState<any[]>([]);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [scoresValid, setScoresValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const validateScores = (scores: any[]) => {
    try {
      // Basic structure validation
      scoresSchema.parse(scores);
      // Game rules validation
      validateGameRules(scores);
      setScoresValid(true);
      setError(null);
    } catch (e) {
      setScoresValid(false);
      if (e instanceof ValidationError) {
        setError(e.message);
      } else {
        setError("Please fill in all fields correctly");
      }
    }
  };

  const handleEdit = async (roundIndex: number) => {
    setError(null);
    try {
      // Fetch the actual round scores from the server
      const response = await fetch(`/api/rounds/${gameId}/${roundIndex + 1}`);
      console.log(response);
      if (!response.ok) throw new Error("Failed to fetch round scores");
      const roundData = await response.json();

      if (
        !roundData ||
        !roundData.id ||
        !roundData.scores ||
        !Array.isArray(roundData.scores)
      ) {
        throw new Error("Invalid round data returned from server");
      }

      setEditingRoundId(roundData.id);

      // Filter out any invalid scores
      const validScores = roundData.scores.filter(
        (score: any) => score && (score.userId || score.guestId)
      );

      const roundScores = validScores
        .map((score: any) => {
          // Determine the player ID (either userId or guestId)
          const playerId = score.userId || score.guestId;
          if (!playerId) {
            console.warn("Score missing both userId and guestId", score);
            return null;
          }

          // Find the matching player in displayScores
          const player = displayScores.find((p) => p.id === playerId);

          return {
            id: playerId,
            username: player?.username || "Unknown Player",
            isGuest: !!score.guestId,
            roundNumber: roundIndex + 1,
            blitzPileRemaining: score.blitzPileRemaining || 0,
            totalCardsPlayed: score.totalCardsPlayed || 0,
            touched: {
              totalCardsPlayed: true,
            },
          };
        })
        .filter(Boolean); // Remove any null entries

      setEditingScores(roundScores);
      setEditingRound(roundIndex);
      validateScores(roundScores);
    } catch (error) {
      console.error(error);
      setError("Failed to load round scores. Please try again.");
    }
  };

  const handleCancel = () => {
    setEditingRound(null);
    setEditingScores([]);
    setEditingRoundId(null);
    setScoresValid(false);
  };

  const handleSave = async () => {
    if (!scoresValid || !editingRoundId) return;

    setError(null);
    setIsSaving(true);
    try {
      // Convert scores back to the format expected by the server
      const scoresToSave = editingScores.map((score) => {
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

      await updateRoundScores(gameId, editingRoundId, scoresToSave);
      setEditingRound(null);
      setEditingScores([]);
      setEditingRoundId(null);
      setScoresValid(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ValidationError) {
        setError(error.message);
      } else {
        setError("Failed to save scores. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleScoreChange = (
    playerId: string,
    field: "blitzPileRemaining" | "totalCardsPlayed",
    value: string
  ) => {
    setError(null);
    // Allow empty string for better typing experience
    if (value === "") {
      setEditingScores((prev) =>
        prev.map((score) =>
          score.id === playerId
            ? {
                ...score,
                [field]: 0,
                touched: {
                  ...score.touched,
                  totalCardsPlayed:
                    field === "totalCardsPlayed"
                      ? true
                      : score.touched.totalCardsPlayed,
                },
              }
            : score
        )
      );
      return;
    }

    const intValue = parseInt(value, 10);
    if (isNaN(intValue)) return;

    const maxValue = field === "blitzPileRemaining" ? 10 : 40;
    if (intValue < 0 || intValue > maxValue) return;

    setEditingScores((prev) =>
      prev.map((score) =>
        score.id === playerId
          ? {
              ...score,
              [field]: intValue,
              touched: {
                ...score.touched,
                totalCardsPlayed:
                  field === "totalCardsPlayed"
                    ? true
                    : score.touched.totalCardsPlayed,
              },
            }
          : score
      )
    );
    validateScores(editingScores);
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Table className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-4 sm:p-6 max-w-md mx-auto mb-4">
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Round</TableHead>
            {displayScores.map((player) => (
              <TableHead
                key={player.id}
                className={`text-xs ${player.isWinner ? "bg-green-50" : ""}`}
              >
                {player.isWinner ? `⭐ ${player.username} ⭐` : player.username}
                {player.isGuest ? " (Guest)" : ""}
              </TableHead>
            ))}
            {!isFinished && <TableHead className="w-24">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: numRounds }).map((_, roundIndex) => (
            <TableRow key={roundIndex}>
              <TableCell className="font-medium bg-slate-50">
                {roundIndex + 1}
              </TableCell>
              {editingRound === roundIndex
                ? // Editing mode
                  displayScores.map((player) => {
                    const editingScore = editingScores.find(
                      (score) => score.id === player.id
                    );
                    return (
                      <TableCell key={player.id} className="space-y-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={editingScore?.blitzPileRemaining ?? ""}
                          onChange={(e) =>
                            handleScoreChange(
                              player.id,
                              "blitzPileRemaining",
                              e.target.value
                            )
                          }
                          min={0}
                          max={10}
                          className="w-full"
                          placeholder="Blitz"
                        />
                        <Input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={editingScore?.totalCardsPlayed ?? ""}
                          onChange={(e) =>
                            handleScoreChange(
                              player.id,
                              "totalCardsPlayed",
                              e.target.value
                            )
                          }
                          min={0}
                          max={40}
                          className="w-full"
                          placeholder="Total"
                        />
                      </TableCell>
                    );
                  })
                : // Display mode
                  displayScores.map((player) => {
                    const score = player.scoresByRound[roundIndex];
                    return (
                      <TableCell key={player.id}>{score ?? "-"}</TableCell>
                    );
                  })}
              {!isFinished && (
                <TableCell>
                  {editingRound === roundIndex ? (
                    <div className="space-x-2">
                      <Button
                        onClick={handleSave}
                        disabled={!scoresValid || isSaving}
                        size="sm"
                        variant="outline"
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        onClick={handleCancel}
                        size="sm"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleEdit(roundIndex)}
                      size="sm"
                      variant="outline"
                    >
                      Edit
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            {displayScores.map((player) => (
              <TableCell
                className={player.isInLead ? "bg-green-100" : ""}
                key={player.id}
              >
                {player.total}
              </TableCell>
            ))}
            {!isFinished && <TableCell />}
          </TableRow>
        </TableFooter>
      </Table>
      {showCharts && (
        <div className="max-w-5xl mx-auto mb-4">
          <ScoreLineGraph displayScores={displayScores} />
        </div>
      )}
    </div>
  );
}

// Wrap with ErrorBoundary and export
export default function ScoreDisplayWithErrorBoundary(props: {
  displayScores: DisplayScores[];
  numRounds: number;
  gameId: string;
  isFinished: boolean;
  showCharts: boolean;
}) {
  return (
    <ErrorBoundary
      componentName="ScoreDisplay"
      context={{
        gameId: props.gameId,
        rounds: props.numRounds,
        players: props.displayScores.length,
        section: "game-detail",
      }}
    >
      <ScoreDisplay {...props} />
    </ErrorBoundary>
  );
}
