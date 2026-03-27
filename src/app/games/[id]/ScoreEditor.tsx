"use client";

import { TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { DisplayScores } from "@/lib/gameLogic";
import { validateGameRules, ValidationError } from "@/lib/validation/gameRules";
import { updateRoundScores } from "@/server/mutations";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { scoresSchema, type EditingScore, type RoundScoreData } from "./scoreTypes";

interface ScoreEditorProps {
  gameId: string;
  roundIndex: number;
  displayScores: DisplayScores[];
  onCancel: () => void;
}

export function ScoreEditor({
  gameId,
  roundIndex,
  displayScores,
  onCancel,
}: ScoreEditorProps) {
  const router = useRouter();
  const [editingScores, setEditingScores] = useState<EditingScore[]>([]);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [scoresValid, setScoresValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const displayScoresRef = useRef(displayScores);
  displayScoresRef.current = displayScores;

  const validateScores = useCallback((scores: EditingScore[]) => {
    try {
      scoresSchema.parse(scores);
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchRoundData() {
      setError(null);
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/rounds/${gameId}/${roundIndex + 1}`
        );
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

        if (cancelled) return;

        const validScores = (roundData.scores as RoundScoreData[]).filter(
          (score) => score && (score.userId || score.guestId)
        );

        const roundScores: EditingScore[] = [];
        for (const score of validScores) {
          const playerId = score.userId ?? score.guestId;
          if (!playerId) continue;

          const player = displayScoresRef.current.find((p) => p.id === playerId);

          roundScores.push({
            id: playerId,
            username: player?.username ?? "Unknown Player",
            isGuest: !!score.guestId,
            roundNumber: roundIndex + 1,
            blitzPileRemaining: score.blitzPileRemaining ?? 0,
            totalCardsPlayed: score.totalCardsPlayed ?? 0,
            touched: {
              totalCardsPlayed: true,
            },
          });
        }

        setEditingScores(roundScores);
        setEditingRoundId(String(roundData.id));
        validateScores(roundScores);
      } catch {
        if (!cancelled) {
          setError("Failed to load round scores. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchRoundData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, roundIndex, validateScores]);

  const handleSave = async () => {
    if (!scoresValid || !editingRoundId) return;

    setError(null);
    setIsSaving(true);
    try {
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

        if (score.isGuest) {
          result.guestId = score.id;
        } else {
          result.userId = score.id;
        }

        return result;
      });

      await updateRoundScores(gameId, editingRoundId, scoresToSave);
      router.refresh();
      onCancel();
    } catch (saveError) {
      if (saveError instanceof ValidationError) {
        setError(saveError.message);
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

    const updated = editingScores.map((score) =>
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
    );
    setEditingScores(updated);
    validateScores(updated);
  };

  if (isLoading) {
    return (
      <>
        {displayScores.map((player) => (
          <TableCell key={player.id}>Loading...</TableCell>
        ))}
        <TableCell>
          <Button onClick={onCancel} size="sm" variant="outline">
            Cancel
          </Button>
        </TableCell>
      </>
    );
  }

  return (
    <>
      {displayScores.map((player) => {
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
      })}
      <TableCell>
        <div className="space-y-2">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-x-2">
            <Button
              onClick={handleSave}
              disabled={!scoresValid || isSaving}
              size="sm"
              variant="outline"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <Button onClick={onCancel} size="sm" variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      </TableCell>
    </>
  );
}
