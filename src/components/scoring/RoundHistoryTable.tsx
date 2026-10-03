"use client";

import { useSyncExternalStore } from "react";
import { Calculator, Pencil } from "lucide-react";
import { type PlayerWithScore, type RoundData } from "./types";
import { calculateRoundScore, GAME_RULES } from "@/lib/validation/gameRules";
import { findPlayerScore } from "./utils";

interface RoundHistoryTableProps {
  players: PlayerWithScore[];
  rounds: RoundData[];
  onEditRound?: (roundIndex: number) => void;
  disabled?: boolean;
}

export const roundEditButtonId = (roundId: string) => `edit-round-${roundId}`;

const SHOW_MATH_STORAGE_KEY = "blitzer:round-history-show-math";

// Per-device preference. The in-memory value keeps the toggle working when
// storage is blocked; listeners keep every mounted table in sync.
let showMathFallback = false;
const showMathListeners = new Set<() => void>();

function subscribeShowMath(listener: () => void) {
  showMathListeners.add(listener);
  return () => {
    showMathListeners.delete(listener);
  };
}

function readShowMath(): boolean {
  try {
    return window.localStorage.getItem(SHOW_MATH_STORAGE_KEY) === "true";
  } catch {
    return showMathFallback;
  }
}

function writeShowMath(value: boolean) {
  showMathFallback = value;
  try {
    window.localStorage.setItem(SHOW_MATH_STORAGE_KEY, String(value));
  } catch {
    // Storage is a convenience; the in-memory value still applies.
  }
  showMathListeners.forEach((listener) => listener());
}

export function RoundHistoryTable({
  players,
  rounds,
  onEditRound,
  disabled = false,
}: RoundHistoryTableProps) {
  const showMath = useSyncExternalStore(
    subscribeShowMath,
    readShowMath,
    () => false,
  );

  if (rounds.length === 0) return null;

  const toggleShowMath = () => writeShowMath(!showMath);

  return (
    <div className="mx-4 space-y-2">
      <div
        role="region"
        aria-label="Round scores"
        tabIndex={0}
        className="overflow-x-auto rounded-xl border border-[#e6d7c3] bg-white focus-visible:outline-2 focus-visible:outline-[#8b5e3c]"
      >
        <table
          className="w-full border-collapse text-sm"
          style={{ minWidth: Math.max(320, (players.length + 1) * 96) }}
        >
          <caption className="p-3 text-left font-semibold text-[#8b5e3c]">
            Round Scores{" "}
            {onEditRound && (
              <span className="font-normal">— choose a round to edit</span>
            )}
          </caption>
          <thead className="bg-[#faf5ed]">
            <tr>
              <th scope="col" className="p-2 text-left">
                Round
              </th>
              {players.map((player) => (
                <th
                  key={player.id}
                  scope="col"
                  className="min-w-24 max-w-40 break-words p-2 text-center"
                  style={{ color: player.color }}
                >
                  {player.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((round, index) => (
              <tr key={round.id} className="border-t border-[#f0e6d2]">
                <th
                  scope="row"
                  className="sticky left-0 bg-white p-1 text-left"
                >
                  {onEditRound ? (
                    <button
                      type="button"
                      id={roundEditButtonId(round.id)}
                      aria-label={`Edit round ${index + 1}`}
                      disabled={disabled}
                      onClick={() => onEditRound(index)}
                      className="flex min-h-11 min-w-16 items-center justify-center gap-2 rounded-md p-2 hover:bg-[#faf5ed] focus-visible:outline-2 focus-visible:outline-[#8b5e3c] disabled:opacity-50"
                    >
                      {index + 1}
                      <Pencil aria-hidden className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="block p-3">{index + 1}</span>
                  )}
                </th>
                {players.map((player) => {
                  const score = findPlayerScore(player, round.scores);
                  const delta = score ? calculateRoundScore(score) : 0;
                  return (
                    <td
                      key={player.id}
                      className={`p-2 text-center ${delta < 0 ? "text-[#b91c1c]" : "text-[#290806]"}`}
                    >
                      <span className="block">
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                      {showMath && score && (
                        <span className="block whitespace-nowrap text-xs font-normal text-[#8b5e3c]">
                          {score.totalCardsPlayed} played
                          {score.blitzPileRemaining > 0 &&
                            ` − ${score.blitzPileRemaining}×${GAME_RULES.BLITZ_PENALTY_MULTIPLIER}`}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-[#e6d7c3] bg-[#faf5ed] font-bold">
            <tr>
              <th scope="row" className="p-3 text-left">
                Total
              </th>
              {players.map((player) => (
                <td key={player.id} className="p-2 text-center">
                  {player.score}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          aria-pressed={showMath}
          onClick={toggleShowMath}
          className="flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-[#8b5e3c] hover:bg-[#faf5ed] focus-visible:outline-2 focus-visible:outline-[#8b5e3c]"
        >
          <Calculator aria-hidden className="h-4 w-4" />
          {showMath ? "Hide the math" : "Show the math"}
        </button>
      </div>
    </div>
  );
}
