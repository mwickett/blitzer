"use client";

import { type PlayerWithScore } from "./types";
import { calculateRoundScore } from "@/lib/validation/gameRules";

interface RoundHistoryTableProps {
  players: PlayerWithScore[];
  rounds: {
    scores: {
      userId?: string | null;
      guestId?: string | null;
      blitzPileRemaining: number;
      totalCardsPlayed: number;
    }[];
  }[];
  editingRound: number | null;
  onEditRound: (roundIndex: number) => void;
}

export function RoundHistoryTable({
  players,
  rounds,
  editingRound,
  onEditRound,
}: RoundHistoryTableProps) {
  if (rounds.length === 0) return null;

  const getPlayerDelta = (
    player: PlayerWithScore,
    roundScores: RoundHistoryTableProps["rounds"][0]["scores"]
  ) => {
    const score = roundScores.find(
      (s) =>
        (player.userId && s.userId === player.userId) ||
        (player.guestId && s.guestId === player.guestId)
    );
    if (!score) return 0;
    return calculateRoundScore(score);
  };

  return (
    <div className="mx-4 bg-white border-[1.5px] border-[#e6d7c3] rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-[#faf5ed] border-b border-[#e6d7c3]">
        <div className="text-[10px] font-semibold text-[#8b5e3c] uppercase tracking-wider">
          Round Scores{" "}
          <span className="font-normal normal-case tracking-normal">
            · tap to edit
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex px-3 py-1.5 border-b border-[#f0e6d2] bg-[#faf5ed]">
        <div className="w-10 text-[10px] font-semibold text-[#8b5e3c]">
          Rnd
        </div>
        {players.map((p) => (
          <div
            key={p.id}
            className="flex-1 text-[10px] font-semibold text-center"
            style={{ color: p.color }}
          >
            {p.name}
          </div>
        ))}
        <div className="w-7" />
      </div>

      {/* Rows */}
      {rounds.map((round, ri) => {
        const isEditing = editingRound === ri;
        return (
          <div
            key={ri}
            onClick={() => !isEditing && onEditRound(ri)}
            className={`flex px-3 py-1.5 border-b border-[#f0e6d2] last:border-b-0 cursor-pointer transition-colors ${
              isEditing ? "bg-[#fef3c7]" : "hover:bg-[#faf5ed]"
            }`}
          >
            <div
              className={`w-10 text-[11px] ${isEditing ? "font-bold text-[#92400e]" : "text-[#8b5e3c]"}`}
            >
              {ri + 1}
            </div>
            {isEditing ? (
              <div className="flex-1 text-[11px] font-semibold text-[#92400e]">
                editing...
              </div>
            ) : (
              players.map((p) => {
                const d = getPlayerDelta(p, round.scores);
                return (
                  <div
                    key={p.id}
                    className={`flex-1 text-xs font-medium text-center ${d < 0 ? "text-[#b91c1c]" : "text-[#290806]"}`}
                  >
                    {d > 0 ? `+${d}` : d}
                  </div>
                );
              })
            )}
            <div className="w-7 flex items-center justify-center">
              {!isEditing && <span className="text-[10px] opacity-40">✏️</span>}
            </div>
          </div>
        );
      })}

      {/* Totals */}
      <div className="flex px-3 py-1.5 bg-[#faf5ed] border-t-2 border-[#e6d7c3]">
        <div className="w-10 text-[11px] font-bold text-[#290806]">Total</div>
        {players.map((p) => (
          <div
            key={p.id}
            className={`flex-1 text-[13px] font-bold text-center ${p.score < 0 ? "text-[#b91c1c]" : "text-[#290806]"}`}
          >
            {p.score}
          </div>
        ))}
        <div className="w-7" />
      </div>
    </div>
  );
}
