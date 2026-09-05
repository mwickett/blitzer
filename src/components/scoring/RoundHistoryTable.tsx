import { Pencil } from "lucide-react";
import { type PlayerWithScore, type RoundData } from "./types";
import { calculateRoundScore } from "@/lib/validation/gameRules";
import { findPlayerScore } from "./utils";

interface RoundHistoryTableProps {
  players: PlayerWithScore[];
  rounds: RoundData[];
  onEditRound?: (roundIndex: number) => void;
  disabled?: boolean;
}

export const roundEditButtonId = (roundId: string) => `edit-round-${roundId}`;

export function RoundHistoryTable({
  players,
  rounds,
  onEditRound,
  disabled = false,
}: RoundHistoryTableProps) {
  if (rounds.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Round scores"
      tabIndex={0}
      className="mx-4 overflow-x-auto rounded-xl border border-[#e6d7c3] bg-white focus-visible:outline-2 focus-visible:outline-[#8b5e3c]"
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
              <th scope="row" className="sticky left-0 bg-white p-1 text-left">
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
                    {delta > 0 ? `+${delta}` : delta}
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
  );
}
