"use client";

import { useMemo, useRef, useState } from "react";
import { type PlayerWithScore, type RoundData } from "./types";
import { type GameStats } from "@/lib/scoring/gameStats";
import { RoundHistoryTable } from "./RoundHistoryTable";
import { RaceTrack } from "./RaceTrack";
import { GraphCarousel } from "./GraphCarousel";
import { ScoreProgressionCard } from "./graphs/ScoreProgressionCard";
import { HotColdCard } from "./graphs/HotColdCard";
import { RoundMvpsCard } from "./graphs/RoundMvpsCard";
import { BlitzPileCard } from "./graphs/BlitzPileCard";
import { buildRoundGraphSeries } from "./roundGraphSeries";
import { GameHighlights } from "./GameHighlights";
import { GuestInvites } from "./GuestInvites";
import { findGameHighlights } from "@/lib/scoring/gameHighlights";
import { usePostHog } from "posthog-js/react";

interface GameOverViewProps {
  winner: PlayerWithScore;
  players: PlayerWithScore[];
  stats: GameStats;
  rounds: RoundData[];
  winThreshold: number;
  onEditRound?: (roundIndex: number) => void;
  onRematch: () => Promise<void> | void;
  onBackToGames: () => void;
  /** When false, render as a read-only spectator view (no member actions) */
  canEdit?: boolean;
  canRematch?: boolean;
}

/** Spreads are averages, so they can carry one decimal place. */
function formatSpread(value: number) {
  return `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(1)}`;
}

export function GameOverView({
  winner,
  players,
  stats,
  rounds,
  winThreshold,
  onEditRound,
  onRematch,
  onBackToGames,
  canEdit = true,
  canRematch = true,
}: GameOverViewProps) {
  const posthog = usePostHog();
  const [isRematching, setIsRematching] = useState(false);
  const [rematchError, setRematchError] = useState<string | null>(null);
  const rematching = useRef(false);
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const { scoresByRound, deltasByRound, blitzByRound, scoredByRound } = useMemo(
    () => buildRoundGraphSeries(players, rounds),
    [players, rounds],
  );
  const highlights = useMemo(
    () =>
      findGameHighlights({
        players,
        winnerId: winner.id,
        scoresByRound,
        deltasByRound,
        blitzByRound,
      }),
    [players, winner.id, scoresByRound, deltasByRound, blitzByRound],
  );
  const handleRematch = async () => {
    if (rematching.current) return;
    rematching.current = true;
    setIsRematching(true);
    setRematchError(null);
    try {
      posthog.capture("game_over_rematch", { player_count: players.length });
    } catch {
      // Optional analytics must not prevent creating the next game.
    }
    try {
      await onRematch();
      // Keep the successful action disabled until the new game opens.
    } catch {
      rematching.current = false;
      setIsRematching(false);
      setRematchError("Unable to create the rematch. Please try again.");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center py-4 border-b border-[#f0e6d2]">
        <h2 className="text-xl font-extrabold text-[#290806]">Game Complete</h2>
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

      <GameHighlights highlights={highlights} players={players} />

      {/* Final race position + retrospective graphs (kept from between-rounds) */}
      {rounds.length > 0 && (
        <>
          <div className="px-4 pt-1 pb-2">
            <RaceTrack players={players} winThreshold={winThreshold} />
          </div>
          <GraphCarousel
            context="game_over"
            graphNames={[
              "score_progression",
              "hot_cold",
              "round_mvps",
              "blitz_pile",
            ]}
          >
            <ScoreProgressionCard
              players={players}
              scoresByRound={scoresByRound}
              winThreshold={winThreshold}
            />
            <HotColdCard players={players} deltasByRound={deltasByRound} />
            <RoundMvpsCard
              players={players}
              deltasByRound={deltasByRound}
              scoredByRound={scoredByRound}
            />
            <BlitzPileCard players={players} blitzByRound={blitzByRound} />
          </GraphCarousel>
        </>
      )}

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
        {stats.widestRound && stats.finalSpread !== null && (
          <>
            <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-lg p-3 text-center">
              <div className="text-xl font-extrabold text-[#290806]">
                {formatSpread(stats.widestRound.range)}
              </div>
              <div className="text-[9px] text-[#8b5e3c] uppercase tracking-wider mt-0.5">
                Widest Round
              </div>
              <div className="text-[10px] text-[#8b5e3c]">
                {stats.widestRound.playerName} vs the field · R
                {stats.widestRound.roundNumber}
              </div>
            </div>
            <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-lg p-3 text-center">
              <div className="text-xl font-extrabold text-[#290806]">
                {formatSpread(stats.finalSpread)}
              </div>
              <div className="text-[9px] text-[#8b5e3c] uppercase tracking-wider mt-0.5">
                Final Spread
              </div>
              <div className="text-[10px] text-[#8b5e3c]">
                Leader vs the field&rsquo;s average
              </div>
            </div>
          </>
        )}
      </div>

      {/* Round history — tap to edit */}
      <div className="pt-4 pb-2">
        <RoundHistoryTable
          players={players}
          rounds={rounds}
          onEditRound={onEditRound}
        />
      </div>

      {canEdit && (
        <GuestInvites
          guests={players.filter((player) => player.isGuest)}
          winnerId={winner.id}
        />
      )}

      {/* Actions — participating editors only; spectators get a read-only result */}
      {canEdit && (
        <div className="px-4 pt-5 pb-6 space-y-2">
          {rematchError && <p role="alert" className="text-sm text-destructive">{rematchError}</p>}
          {canRematch && (
            <button
              onClick={handleRematch}
              disabled={isRematching}
              className="w-full py-3.5 rounded-xl text-[15px] font-bold bg-[#290806] text-white hover:bg-[#3d1a0a] transition-colors cursor-pointer"
            >
              {isRematching ? "Creating rematch…" : "New Game with Same Players"}
            </button>
          )}
          <button
            disabled={isRematching}
            onClick={() => {
              try {
                posthog.capture("game_over_back_to_games");
              } catch {
                // Navigation stays available if analytics is unavailable.
              }
              onBackToGames();
            }}
            className="w-full py-3 rounded-xl text-[13px] font-semibold border-[1.5px] border-[#e6d7c3] bg-white text-[#8b5e3c] hover:bg-[#faf5ed] transition-colors cursor-pointer"
          >
            Back to Games
          </button>
        </div>
      )}
    </div>
  );
}
