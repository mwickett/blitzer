"use client";

import { useState } from "react";
import { type ScoringPlayer } from "./types";
import { calculateRoundScore } from "@/lib/validation/gameRules";

interface RoundEditorProps {
  roundIndex: number;
  players: ScoringPlayer[];
  roundData: Record<
    string,
    { blitzPileRemaining: number; totalCardsPlayed: number }
  >;
  onSave: (
    updated: Record<
      string,
      { blitzPileRemaining: number; totalCardsPlayed: number }
    >
  ) => void;
  onCancel: () => void;
}

export function RoundEditor({
  roundIndex,
  players,
  roundData,
  onSave,
  onCancel,
}: RoundEditorProps) {
  const [editData, setEditData] = useState<
    Record<string, { blitz: string; cards: string }>
  >(() =>
    Object.fromEntries(
      players.map((p) => [
        p.id,
        {
          blitz: String(roundData[p.id]?.blitzPileRemaining ?? 0),
          cards: String(roundData[p.id]?.totalCardsPlayed ?? 0),
        },
      ])
    )
  );

  const handleSave = () => {
    const updated: Record<
      string,
      { blitzPileRemaining: number; totalCardsPlayed: number }
    > = {};
    for (const p of players) {
      updated[p.id] = {
        blitzPileRemaining: Math.max(
          0,
          Math.min(10, parseInt(editData[p.id].blitz) || 0)
        ),
        totalCardsPlayed: Math.max(
          0,
          Math.min(40, parseInt(editData[p.id].cards) || 0)
        ),
      };
    }
    onSave(updated);
  };

  return (
    <div className="mx-4 my-3 bg-[#fffbeb] border-2 border-[#fbbf24] rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-bold text-[#290806]">
          Edit Round {roundIndex + 1}
        </div>
        <div className="text-[9px] font-semibold bg-[#fbbf24] text-[#92400e] px-2 py-0.5 rounded-md">
          Editing
        </div>
      </div>

      <div className="space-y-2">
        {players.map((p) => {
          const orig = roundData[p.id];
          const cur = editData[p.id];
          const blitzChanged =
            cur.blitz !== String(orig?.blitzPileRemaining ?? 0);
          const cardsChanged =
            cur.cards !== String(orig?.totalCardsPlayed ?? 0);
          const blitz = parseInt(cur.blitz) || 0;
          const cards = parseInt(cur.cards) || 0;
          const delta = calculateRoundScore({
            blitzPileRemaining: blitz,
            totalCardsPlayed: cards,
          });

          return (
            <div
              key={p.id}
              className="flex items-center gap-2 bg-white border-[1.5px] border-[#e6d7c3] rounded-lg p-2"
              style={{ borderLeftWidth: "4px", borderLeftColor: p.color }}
            >
              <div className="w-12 text-[12px] font-semibold text-[#290806] flex-shrink-0">
                {p.name}
              </div>
              <div className="flex gap-1.5 flex-1">
                <div className="flex-1">
                  <label className="block text-[8px] text-[#8b5e3c] uppercase tracking-wider font-medium mb-0.5">
                    Blitz left
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={cur.blitz}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        [p.id]: { ...prev[p.id], blitz: e.target.value },
                      }))
                    }
                    className={`w-full h-9 border-[1.5px] rounded-md text-[16px] font-semibold text-center text-[#290806] focus:outline-none transition-colors ${
                      blitzChanged
                        ? "bg-[#fffbeb] border-[#fbbf24]"
                        : "bg-[#fff7ea] border-[#e6d7c3]"
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[8px] text-[#8b5e3c] uppercase tracking-wider font-medium mb-0.5">
                    Cards played
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={cur.cards}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        [p.id]: { ...prev[p.id], cards: e.target.value },
                      }))
                    }
                    className={`w-full h-9 border-[1.5px] rounded-md text-[16px] font-semibold text-center text-[#290806] focus:outline-none transition-colors ${
                      cardsChanged
                        ? "bg-[#fffbeb] border-[#fbbf24]"
                        : "bg-[#fff7ea] border-[#e6d7c3]"
                    }`}
                  />
                </div>
              </div>
              <div
                className={`w-9 text-right text-[11px] font-bold flex-shrink-0 ${
                  delta < 0 ? "text-[#b91c1c]" : "text-[#2a6517]"
                }`}
              >
                {delta > 0 ? `+${delta}` : delta}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg text-[13px] font-bold bg-[#f0e6d2] text-[#8b5e3c] cursor-pointer hover:bg-[#e6d7c3] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-2.5 rounded-lg text-[13px] font-bold bg-[#2a6517] text-white cursor-pointer hover:bg-[#1d4a10] transition-colors"
        >
          Save Changes
        </button>
      </div>
      <div className="text-[9px] text-[#8b5e3c] text-center mt-2 italic">
        Saving will recalculate all scores from round {roundIndex + 1} onward
      </div>
    </div>
  );
}
