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
import { DisplayScores } from "@/lib/gameLogic";
import { useState } from "react";
import { ScoreEditor } from "./ScoreEditor";

function ScoreDisplay({
  displayScores,
  numRounds,
  gameId,
  isFinished,
}: {
  displayScores: DisplayScores[];
  numRounds: number;
  gameId: string;
  isFinished: boolean;
}) {
  const [editingRound, setEditingRound] = useState<number | null>(null);

  return (
    <div className="space-y-6">
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
              {editingRound === roundIndex ? (
                <ScoreEditor
                  gameId={gameId}
                  roundIndex={roundIndex}
                  displayScores={displayScores}
                  onCancel={() => setEditingRound(null)}
                />
              ) : (
                <>
                  {displayScores.map((player) => {
                    const score = player.scoresByRound[roundIndex];
                    return (
                      <TableCell key={player.id}>{score ?? "-"}</TableCell>
                    );
                  })}
                  {!isFinished && (
                    <TableCell>
                      <Button
                        onClick={() => setEditingRound(roundIndex)}
                        size="sm"
                        variant="outline"
                      >
                        Edit
                      </Button>
                    </TableCell>
                  )}
                </>
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
      <div className="max-w-5xl mx-auto mb-4">
        <ScoreLineGraph displayScores={displayScores} />
      </div>
    </div>
  );
}

// Wrap with ErrorBoundary and export
export default function ScoreDisplayWithErrorBoundary(props: {
  displayScores: DisplayScores[];
  numRounds: number;
  gameId: string;
  isFinished: boolean;
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
