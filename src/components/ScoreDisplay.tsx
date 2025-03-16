"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Player {
  userId: string;
  username: string;
  isWinner: boolean;
  isInLead: boolean;
  total: number;
  scoresByRound: (number | number[])[];
}

interface RoundScore {
  round: number;
  scores: Record<
    string,
    {
      score: number;
      cardsPlayed: number;
      pileRemaining: number;
    }
  >;
}

interface ScoreDisplayProps {
  displayScores: Player[];
  numRounds: number;
}

export default function ScoreDisplay({
  displayScores,
  numRounds,
}: ScoreDisplayProps) {
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  // Transform displayScores into rounds data structure
  const rounds: RoundScore[] = Array.from(
    { length: numRounds },
    (_, index) => ({
      round: index + 1,
      scores: displayScores.reduce((acc, player) => {
        const roundScore = Array.isArray(player.scoresByRound[index])
          ? (player.scoresByRound[index] as number[])[0]
          : (player.scoresByRound[index] as number) ?? 0;

        acc[player.username] = {
          score: roundScore,
          cardsPlayed: 0, // These fields will be populated later when we have the data
          pileRemaining: 0,
        };
        return acc;
      }, {} as Record<string, { score: number; cardsPlayed: number; pileRemaining: number }>),
    })
  );

  const winnerName = displayScores.find((player) => player.isWinner)?.username;

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="grid grid-cols-5 gap-4 mb-2">
        <div className="font-medium text-gray-600">Round</div>
        {displayScores.map((player) => (
          <div
            key={player.userId}
            className={`text-right font-medium text-gray-600 ${
              player.username === winnerName ? "bg-green-50" : ""
            }`}
          >
            {player.username}
            {player.username === winnerName && (
              <Star className="inline-block ml-1 w-4 h-4 text-yellow-400 fill-yellow-400" />
            )}
          </div>
        ))}
      </div>

      {rounds.map((roundData) => (
        <Collapsible
          key={roundData.round}
          open={expandedRound === roundData.round}
          onOpenChange={() =>
            setExpandedRound(
              expandedRound === roundData.round ? null : roundData.round
            )
          }
        >
          <div className="grid grid-cols-5 gap-4 items-center py-2 border-t">
            <div className="flex items-center gap-2">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 p-0">
                  {expandedRound === roundData.round ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <span>{roundData.round}</span>
            </div>
            {displayScores.map((player) => (
              <div
                key={player.userId}
                className={`text-right ${
                  player.username === winnerName ? "bg-green-50" : ""
                }`}
              >
                {roundData.scores[player.username].score}
              </div>
            ))}
          </div>

          <CollapsibleContent>
            <div className="grid gap-2 py-2">
              <div className="grid grid-cols-5 gap-4 items-center py-2 bg-gray-50">
                <div className="pl-10 text-gray-500">Cards Played</div>
                {displayScores.map((player) => (
                  <div
                    key={`${player.userId}-cards`}
                    className={`text-right ${
                      player.username === winnerName ? "bg-green-50" : ""
                    }`}
                  >
                    {roundData.scores[player.username].cardsPlayed}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-4 items-center py-2 bg-gray-50">
                <div className="pl-10 text-gray-500">Pile Remaining (x2)</div>
                {displayScores.map((player) => (
                  <div
                    key={`${player.userId}-pile`}
                    className={`text-right ${
                      player.username === winnerName ? "bg-green-50" : ""
                    }`}
                  >
                    {roundData.scores[player.username].pileRemaining} (
                    {roundData.scores[player.username].pileRemaining * 2})
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}

      <div className="grid grid-cols-5 gap-4 items-center py-2 border-t">
        <div className="font-bold">Total</div>
        {displayScores.map((player) => (
          <div
            key={player.userId}
            className={`text-right font-bold ${
              player.username === winnerName ? "bg-green-50" : ""
            }`}
          >
            {player.total}
          </div>
        ))}
      </div>
    </div>
  );
}
