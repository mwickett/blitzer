"use client";

import { type PlayerWithScore } from "./types";
import { type GameStats } from "@/lib/scoring/gameStats";
import { RoundHistoryTable } from "./RoundHistoryTable";
import { usePostHog } from "posthog-js/react";

interface GameOverViewProps {
  winner: PlayerWithScore;
  players: PlayerWithScore[];
  stats: GameStats;
  rounds: {
    scores: {
      userId?: string | null;
      guestId?: string | null;
      blitzPileRemaining: number;
      totalCardsPlayed: number;
    }[];
  }[];
  onEditRound?: (roundIndex: number) => void;
  onRematch: () => void;
  onBackToCircle: () => void;
}

export function GameOverView({
  winner,
  players,
  stats,
  rounds,
  onEditRound,
  onRematch,
  onBackToCircle,
}: GameOverViewProps) {
  const posthog = usePostHog();
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div>
      {/* Header */}
      <div className="text-center py-4 border-b border-[#f0e6d2]">
        <h2 className="text-xl font-extrabold text-[#290806]">
          Game Complete
        </h2>
        <div className="text-xs text-[#8b5e3c] mt-1">
          {stats.roundsPlayed} rounds · {players.length} players
        </div>
      </div>

      {/* Winner card */}
      <div
        className="mx-4 mt-4 mb-3 p-5 rounded-2xl text-center relative overflow-hidden"
        style={{ border: `2px solid ${winner.color}` }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundColor: winner.color }}
        />
        <div className="relative z-10">
          <div className="text-4xl mb-2">🏆</div>
          <div
            className="text-[10px] font-bold uppercase tracking-widest mb-1"
            style={{ color: winner.color }}
          >
            Winner
          </div>
          <div
            className="text-[28px] font-black"
            style={{ color: winner.color }}
          >
            {winner.name}
          </div>
          <div className="text-lg font-bold" style={{ color: winner.color }}>
            {winner.score} points
          </div>
        </div>
      </div>

      {/* Final standings */}
      <div className="px-4 space-y-1.5">
        {sorted.map((player, i) => (
          <div
            key={player.id}
            className={`flex items-center justify-between py-2.5 px-3 bg-white border-[1.5px] border-[#e6d7c3] rounded-lg ${
              player.id === winner.id ? "bg-[#eff6ff]" : ""
            }`}
            style={{ borderLeftWidth: "5px", borderLeftColor: player.color }}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-extrabold text-[#8b5e3c] w-5">
                {i + 1}
              </span>
              <span className="text-sm font-semibold text-[#290806]">
                {player.name}
              </span>
            </div>
            <div className="text-right">
              <div
                className="text-base font-extrabold"
                style={{
                  color: player.score < 0 ? "#b91c1c" : player.color,
                }}
              >
                {player.score}
              </div>
              <div className="text-[9px] text-[#8b5e3c]">
                {stats.roundWins[player.id] ?? 0} round win
                {(stats.roundWins[player.id] ?? 0) !== 1 ? "s" : ""} ·{" "}
                {stats.blitzCounts[player.id] ?? 0} blitz
                {(stats.blitzCounts[player.id] ?? 0) !== 1 ? "es" : ""}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Game stats grid */}
      <div className="mx-4 mt-4 grid grid-cols-2 gap-2">
        <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-lg p-3 text-center">
          <div className="text-xl font-extrabold text-[#290806]">
            {stats.roundsPlayed}
          </div>
          <div className="text-[9px] text-[#8b5e3c] uppercase tracking-wider mt-0.5">
            Rounds Played
          </div>
        </div>
        <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-lg p-3 text-center">
          <div className="text-xl font-extrabold text-[#2a6517]">
            +{stats.biggestRound.delta}
          </div>
          <div className="text-[9px] text-[#8b5e3c] uppercase tracking-wider mt-0.5">
            Biggest Round
          </div>
          <div className="text-[10px] text-[#8b5e3c]">
            {stats.biggestRound.playerName} · R{stats.biggestRound.roundNumber}
          </div>
        </div>
        <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-lg p-3 text-center">
          <div className="text-xl font-extrabold text-[#b91c1c]">
            {stats.worstRound.delta}
          </div>
          <div className="text-[9px] text-[#8b5e3c] uppercase tracking-wider mt-0.5">
            Worst Round
          </div>
          <div className="text-[10px] text-[#8b5e3c]">
            {stats.worstRound.playerName} · R{stats.worstRound.roundNumber}
          </div>
        </div>
        <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-lg p-3 text-center">
          <div className="text-xl font-extrabold text-[#290806]">
            {stats.totalBlitzes}
          </div>
          <div className="text-[9px] text-[#8b5e3c] uppercase tracking-wider mt-0.5">
            Total Blitzes
          </div>
        </div>
      </div>

      {/* Round history — tap to edit */}
      <div className="pt-4 pb-2">
        <RoundHistoryTable
          players={players}
          rounds={rounds}
          onEditRound={onEditRound}
        />
      </div>

      {/* Actions */}
      <div className="px-4 pt-5 pb-6 space-y-2">
        <button
          onClick={() => {
            posthog.capture("game_over_rematch", {
              player_count: players.length,
            });
            onRematch();
          }}
          className="w-full py-3.5 rounded-xl text-[15px] font-bold bg-[#290806] text-white hover:bg-[#3d1a0a] transition-colors cursor-pointer"
        >
          New Game with Same Players
        </button>
        <button
          onClick={() => {
            posthog.capture("game_over_back_to_circle");
            onBackToCircle();
          }}
          className="w-full py-3 rounded-xl text-[13px] font-semibold border-[1.5px] border-[#e6d7c3] bg-white text-[#8b5e3c] hover:bg-[#faf5ed] transition-colors cursor-pointer"
        >
          Back to Circle
        </button>
      </div>
    </div>
  );
}
