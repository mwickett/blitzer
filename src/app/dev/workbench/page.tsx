"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { ScoreEntryCard } from "@/components/scoring/ScoreEntryCard";
import { ColorPicker } from "@/components/scoring/ColorPicker";
import { RaceTrack } from "@/components/scoring/RaceTrack";
import { getEntryStatus, type PlayerEntry, type PlayerWithScore } from "@/components/scoring/types";
import { ACCENT_COLORS } from "@/lib/scoring/colors";

// --- Types ---

type Player = {
  id: string;
  name: string;
  color: string;
  colorLabel: string;
};

type RoundData = Record<string, { blitzRemaining: number; cardsPlayed: number }>;

// --- Score Calculation ---

function calcDelta(blitz: number, cards: number): number {
  return cards - 2 * blitz;
}

function calcScores(players: Player[], rounds: RoundData[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const p of players) scores[p.id] = 0;
  for (const round of rounds) {
    for (const pid of Object.keys(round)) {
      const r = round[pid];
      scores[pid] = (scores[pid] ?? 0) + calcDelta(r.blitzRemaining, r.cardsPlayed);
    }
  }
  return scores;
}

// --- Undo Toast ---

function UndoToast({ roundNumber, onUndo, onDismiss }: { roundNumber: number; onUndo: () => void; onDismiss: () => void }) {
  const [timeLeft, setTimeLeft] = useState(100);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Defer dismiss to avoid setState during render
          setTimeout(onDismiss, 0);
          return 0;
        }
        return prev - 2;
      });
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[408px] z-50">
      <div className="bg-[#290806] text-white rounded-xl px-4 pt-3 pb-4 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium">Round {roundNumber} submitted</span>
          <button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); onUndo(); }}
            className="text-[13px] font-bold text-[#fbbf24] px-3 py-1 rounded-lg bg-[rgba(251,191,36,0.15)] hover:bg-[rgba(251,191,36,0.25)] transition-colors cursor-pointer">
            Undo
          </button>
        </div>
        <div className="mt-2 h-[3px] bg-[rgba(255,255,255,0.15)] rounded-full overflow-hidden">
          <div className="h-full bg-[#fbbf24] rounded-full transition-all duration-100" style={{ width: `${timeLeft}%` }} />
        </div>
      </div>
    </div>
  );
}

// --- Inline Round Editor ---

function RoundEditor({ roundIndex, players, roundData, onSave, onCancel }: {
  roundIndex: number;
  players: Player[];
  roundData: RoundData;
  onSave: (updated: RoundData) => void;
  onCancel: () => void;
}) {
  const [editData, setEditData] = useState<Record<string, { blitzRemaining: string; cardsPlayed: string }>>(() =>
    Object.fromEntries(players.map((p) => [p.id, {
      blitzRemaining: String(roundData[p.id]?.blitzRemaining ?? 0),
      cardsPlayed: String(roundData[p.id]?.cardsPlayed ?? 0),
    }]))
  );

  const handleSave = () => {
    const updated: RoundData = {};
    for (const p of players) {
      updated[p.id] = {
        blitzRemaining: Math.max(0, Math.min(10, parseInt(editData[p.id].blitzRemaining) || 0)),
        cardsPlayed: Math.max(0, Math.min(40, parseInt(editData[p.id].cardsPlayed) || 0)),
      };
    }
    onSave(updated);
  };

  return (
    <div className="mx-4 my-3 bg-[#fffbeb] border-2 border-[#fbbf24] rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-bold text-[#290806]">Edit Round {roundIndex + 1}</div>
        <div className="text-[9px] font-semibold bg-[#fbbf24] text-[#92400e] px-2 py-0.5 rounded-md">Editing</div>
      </div>
      <div className="space-y-2">
        {players.map((p) => {
          const orig = roundData[p.id];
          const cur = editData[p.id];
          const blitzChanged = cur.blitzRemaining !== String(orig?.blitzRemaining ?? 0);
          const cardsChanged = cur.cardsPlayed !== String(orig?.cardsPlayed ?? 0);
          const blitz = parseInt(cur.blitzRemaining) || 0;
          const cards = parseInt(cur.cardsPlayed) || 0;
          const delta = calcDelta(blitz, cards);

          return (
            <div key={p.id} className="flex items-center gap-2 bg-white border-[1.5px] border-[#e6d7c3] rounded-lg p-2" style={{ borderLeftWidth: "4px", borderLeftColor: p.color }}>
              <div className="w-12 text-[12px] font-semibold text-[#290806] flex-shrink-0">{p.name}</div>
              <div className="flex gap-1.5 flex-1">
                <div className="flex-1">
                  <label className="block text-[8px] text-[#8b5e3c] uppercase tracking-wider font-medium mb-0.5">Blitz left</label>
                  <input type="number" inputMode="numeric" min={0} max={10} value={cur.blitzRemaining}
                    onChange={(e) => setEditData((prev) => ({ ...prev, [p.id]: { ...prev[p.id], blitzRemaining: e.target.value } }))}
                    className={`w-full h-9 border-[1.5px] rounded-md text-[16px] font-semibold text-center text-[#290806] focus:outline-none transition-colors ${blitzChanged ? "bg-[#fffbeb] border-[#fbbf24]" : "bg-[#fff7ea] border-[#e6d7c3]"}`} />
                </div>
                <div className="flex-1">
                  <label className="block text-[8px] text-[#8b5e3c] uppercase tracking-wider font-medium mb-0.5">Cards played</label>
                  <input type="number" inputMode="numeric" min={0} max={40} value={cur.cardsPlayed}
                    onChange={(e) => setEditData((prev) => ({ ...prev, [p.id]: { ...prev[p.id], cardsPlayed: e.target.value } }))}
                    className={`w-full h-9 border-[1.5px] rounded-md text-[16px] font-semibold text-center text-[#290806] focus:outline-none transition-colors ${cardsChanged ? "bg-[#fffbeb] border-[#fbbf24]" : "bg-[#fff7ea] border-[#e6d7c3]"}`} />
                </div>
              </div>
              <div className={`w-9 text-right text-[11px] font-bold flex-shrink-0 ${delta < 0 ? "text-[#b91c1c]" : "text-[#2a6517]"}`}>
                {delta > 0 ? `+${delta}` : delta}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-[13px] font-bold bg-[#f0e6d2] text-[#8b5e3c] cursor-pointer hover:bg-[#e6d7c3] transition-colors">Cancel</button>
        <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg text-[13px] font-bold bg-[#2a6517] text-white cursor-pointer hover:bg-[#1d4a10] transition-colors">Save Changes</button>
      </div>
      <div className="text-[9px] text-[#8b5e3c] text-center mt-2 italic">Saving will recalculate all scores from round {roundIndex + 1} onward</div>
    </div>
  );
}

// --- Workbench Page ---

const DEFAULT_PLAYERS: Player[] = [
  { id: "1", name: "Mike", color: "#3b82f6", colorLabel: "Blue" },
  { id: "2", name: "Sarah", color: "#ef4444", colorLabel: "Red" },
  { id: "3", name: "Dan", color: "#eab308", colorLabel: "Yellow" },
  { id: "4", name: "Jo", color: "#22c55e", colorLabel: "Green" },
];

export default function WorkbenchPage() {
  const [players, setPlayers] = useState<Player[]>(DEFAULT_PLAYERS);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [roundEntries, setRoundEntries] = useState<Record<string, PlayerEntry>>(
    () => Object.fromEntries(DEFAULT_PLAYERS.map((p) => [p.id, { blitzRemaining: null, cardsPlayed: null }]))
  );
  const [winThreshold, setWinThreshold] = useState(75);
  const [pillThreshold, setPillThreshold] = useState(8);
  const [editingPlayers, setEditingPlayers] = useState(false);
  const [editingRound, setEditingRound] = useState<number | null>(null);
  const [undoState, setUndoState] = useState<{ roundNumber: number; previousRounds: RoundData[]; previousEntries: Record<string, PlayerEntry> } | null>(null);

  const usedColors = players.map((p) => p.color);
  const scores = useMemo(() => calcScores(players, rounds), [players, rounds]);
  const playersWithScores: PlayerWithScore[] = useMemo(
    () => players.map((p) => ({ ...p, score: scores[p.id] ?? 0, isGuest: false })),
    [players, scores]
  );
  const roundNumber = rounds.length + 1;

  const allComplete = useMemo(() => Object.values(roundEntries).every((e) => getEntryStatus(e) === "complete"), [roundEntries]);
  const remainingCount = useMemo(() => Object.values(roundEntries).filter((e) => getEntryStatus(e) !== "complete").length, [roundEntries]);
  const winner = useMemo(() => players.find((p) => (scores[p.id] ?? 0) >= winThreshold), [players, scores, winThreshold]);

  const handleUpdateEntry = useCallback((playerId: string, field: "blitzRemaining" | "cardsPlayed", value: number | null) => {
    setRoundEntries((prev) => ({ ...prev, [playerId]: { ...prev[playerId], [field]: value } }));
  }, []);

  const handleSubmitRound = useCallback(() => {
    if (!allComplete) return;

    // Validate: at least one player must have blitzed (0 remaining)
    const hasBlitz = players.some((p) => roundEntries[p.id].blitzRemaining === 0);
    if (!hasBlitz) {
      alert("At least one player must blitz (have 0 cards remaining)");
      return;
    }

    // Save state for undo
    const previousRounds = [...rounds];
    const previousEntries = { ...roundEntries };

    const newRound: RoundData = {};
    for (const p of players) {
      const entry = roundEntries[p.id];
      newRound[p.id] = { blitzRemaining: entry.blitzRemaining ?? 0, cardsPlayed: entry.cardsPlayed ?? 0 };
    }

    setRounds((prev) => [...prev, newRound]);
    setRoundEntries(Object.fromEntries(players.map((p) => [p.id, { blitzRemaining: null, cardsPlayed: null }])));
    setUndoState({ roundNumber: rounds.length + 1, previousRounds, previousEntries });
  }, [allComplete, roundEntries, players, rounds]);

  const handleUndo = useCallback(() => {
    if (!undoState) return;
    setRounds(undoState.previousRounds);
    setRoundEntries(undoState.previousEntries);
    setUndoState(null);
  }, [undoState]);

  const handleDismissUndo = useCallback(() => { setUndoState(null); }, []);

  const handleSaveRoundEdit = useCallback((roundIndex: number, updated: RoundData) => {
    setRounds((prev) => {
      const next = [...prev];
      next[roundIndex] = updated;
      return next;
    });
    setEditingRound(null);
  }, []);

  const handleReset = useCallback(() => {
    setRounds([]);
    setRoundEntries(Object.fromEntries(players.map((p) => [p.id, { blitzRemaining: null, cardsPlayed: null }])));
    setEditingRound(null);
    setUndoState(null);
  }, [players]);

  const handleAddPlayer = useCallback(() => {
    const availableColor = ACCENT_COLORS.find((c) => !usedColors.includes(c.value));
    if (!availableColor) return;
    const id = String(Date.now());
    const newPlayer: Player = { id, name: `Player ${players.length + 1}`, color: availableColor.value, colorLabel: availableColor.label };
    setPlayers((prev) => [...prev, newPlayer]);
    setRoundEntries((prev) => ({ ...prev, [id]: { blitzRemaining: null, cardsPlayed: null } }));
  }, [players, usedColors]);

  const handleRemovePlayer = useCallback((id: string) => {
    if (players.length <= 2) return;
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    setRoundEntries((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }, [players.length]);

  const handleUpdatePlayerName = useCallback((id: string, name: string) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);

  const handleUpdatePlayerColor = useCallback((id: string, color: string) => {
    const label = ACCENT_COLORS.find((c) => c.value === color)?.label ?? "";
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, color, colorLabel: label } : p)));
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f2e9]">
      <div className="max-w-[440px] mx-auto px-4 pb-8">
        {/* Workbench header */}
        <div className="pt-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-bold text-[#290806]">Scoring Workbench</h1>
            <div className="flex gap-2">
              <button onClick={() => setEditingPlayers(!editingPlayers)} className="text-xs font-medium text-[#8b5e3c] hover:text-[#290806] px-2 py-1 rounded-lg bg-[#f0e6d2] transition-colors">
                {editingPlayers ? "Done" : "Edit Players"}
              </button>
              <button onClick={handleReset} className="text-xs font-medium text-[#b91c1c] hover:text-[#991b1b] px-2 py-1 rounded-lg bg-[#fef2f2] transition-colors">Reset</button>
            </div>
          </div>
          <p className="text-[11px] text-[#8b5e3c]">Interactive prototype — enter scores, submit rounds, watch the race track update</p>
        </div>

        {/* Controls panel */}
        <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-3 mb-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label className="block text-[9px] text-[#8b5e3c] uppercase tracking-wider font-medium mb-1">Win threshold</label>
              <input type="number" value={winThreshold} onChange={(e) => setWinThreshold(parseInt(e.target.value) || 75)}
                className="w-full h-8 bg-[#fff7ea] border border-[#e6d7c3] rounded-lg text-sm font-semibold text-center text-[#290806] focus:border-[#8b5e3c] focus:outline-none" />
            </div>
            <div className="flex-1">
              <label className="block text-[9px] text-[#8b5e3c] uppercase tracking-wider font-medium mb-1">Pill merge distance</label>
              <input type="range" min={2} max={20} value={pillThreshold} onChange={(e) => setPillThreshold(parseInt(e.target.value))} className="w-full accent-[#290806]" />
              <div className="text-[9px] text-[#8b5e3c] text-center">{pillThreshold}%</div>
            </div>
          </div>
        </div>

        {/* Player editing panel */}
        {editingPlayers && (
          <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-3 mb-4 space-y-3">
            <div className="text-[10px] font-semibold text-[#8b5e3c] uppercase tracking-wider">Players & Colors</div>
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <div className="w-3 h-8 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
                <input type="text" value={p.name} onChange={(e) => handleUpdatePlayerName(p.id, e.target.value)}
                  className="flex-1 h-8 bg-[#fff7ea] border border-[#e6d7c3] rounded-lg px-2 text-sm font-medium text-[#290806] focus:border-[#8b5e3c] focus:outline-none" />
                <ColorPicker value={p.color} onChange={(c) => handleUpdatePlayerColor(p.id, c)} usedColors={usedColors} />
                {players.length > 2 && (
                  <button onClick={() => handleRemovePlayer(p.id)} className="text-[#b91c1c] hover:text-[#991b1b] text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#fef2f2] transition-colors">×</button>
                )}
              </div>
            ))}
            {players.length < 6 && (
              <button onClick={handleAddPlayer} className="w-full h-8 border border-dashed border-[#d1bfa8] rounded-lg text-xs font-medium text-[#8b5e3c] hover:border-[#8b5e3c] hover:text-[#290806] transition-colors">+ Add Player</button>
            )}
          </div>
        )}

        {/* Game area */}
        <div className="bg-[#fff7ea] border-[2px] border-[#e6d7c3] rounded-2xl overflow-hidden shadow-lg">
          {/* Round header */}
          <div className="px-5 pt-4 pb-2 bg-[#fff7ea] sticky top-0 z-20 border-b border-[#f0e6d2]">
            <h2 className="text-lg font-bold text-[#290806]">
              {editingRound !== null ? `Editing Round ${editingRound + 1}` : winner ? "Game Over!" : `Round ${roundNumber}`}
            </h2>
            <div className="text-xs text-[#8b5e3c]">
              {editingRound !== null ? `Modifying round ${editingRound + 1} of ${rounds.length}` : winner ? `${winner.name} wins with ${scores[winner.id]} points!` : `First to ${winThreshold} wins`}
            </div>
          </div>

          {/* Race Track */}
          <div className="px-5 pt-4 pb-2">
            <RaceTrack players={playersWithScores} winThreshold={winThreshold} pillThreshold={pillThreshold} />
          </div>

          {/* Inline round editor (replaces score entry when editing) */}
          {editingRound !== null ? (
            <RoundEditor
              roundIndex={editingRound}
              players={players}
              roundData={rounds[editingRound]}
              onSave={(updated) => handleSaveRoundEdit(editingRound, updated)}
              onCancel={() => setEditingRound(null)}
            />
          ) : (
            <>
              {/* Player cards */}
              <div className="px-4 pt-2 pb-2 space-y-2.5">
                {players.map((player) => (
                  <ScoreEntryCard key={player.id} name={player.name} color={player.color} score={scores[player.id] ?? 0} entry={roundEntries[player.id]}
                    onUpdate={(field, value) => handleUpdateEntry(player.id, field, value)} status={getEntryStatus(roundEntries[player.id])} />
                ))}
              </div>

              {/* Submit button */}
              <div className="px-4 pb-5 pt-2">
                <button onClick={handleSubmitRound} disabled={!allComplete || !!winner}
                  className={`w-full py-3.5 rounded-xl text-[15px] font-bold transition-all ${allComplete && !winner ? "bg-[#2a6517] text-white hover:bg-[#1d4a10] cursor-pointer" : "bg-[#f0e6d2] text-[#d1bfa8] cursor-not-allowed"}`}>
                  {winner ? "Game Complete" : allComplete ? "Submit Round" : `Submit Round (${remainingCount} remaining)`}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Round history */}
        {rounds.length > 0 && (
          <div className="mt-4 bg-white border-[1.5px] border-[#e6d7c3] rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-[#faf5ed] border-b border-[#e6d7c3]">
              <div className="text-[10px] font-semibold text-[#8b5e3c] uppercase tracking-wider">
                Round History <span className="font-normal normal-case tracking-normal">· tap row to edit</span>
              </div>
            </div>
            {/* Header */}
            <div className="flex px-3 py-1.5 border-b border-[#f0e6d2] bg-[#faf5ed]">
              <div className="w-10 text-[10px] font-semibold text-[#8b5e3c]">Rnd</div>
              {players.map((p) => (
                <div key={p.id} className="flex-1 text-[10px] font-semibold text-center" style={{ color: p.color }}>{p.name}</div>
              ))}
              <div className="w-7" />
            </div>
            {/* Rows */}
            {rounds.map((round, ri) => {
              const isEditing = editingRound === ri;
              return (
                <div key={ri} onClick={() => { if (!isEditing) { setEditingRound(ri); setUndoState(null); } }}
                  className={`flex px-3 py-1.5 border-b border-[#f0e6d2] last:border-b-0 cursor-pointer transition-colors ${isEditing ? "bg-[#fef3c7]" : "hover:bg-[#faf5ed]"}`}>
                  <div className={`w-10 text-[11px] ${isEditing ? "font-bold text-[#92400e]" : "text-[#8b5e3c]"}`}>{ri + 1}</div>
                  {isEditing ? (
                    <div className="flex-1 text-[11px] font-semibold text-[#92400e]">editing...</div>
                  ) : (
                    players.map((p) => {
                      const r = round[p.id];
                      const d = r ? calcDelta(r.blitzRemaining, r.cardsPlayed) : 0;
                      return (
                        <div key={p.id} className={`flex-1 text-xs font-medium text-center ${d < 0 ? "text-[#b91c1c]" : "text-[#290806]"}`}>
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
                <div key={p.id} className={`flex-1 text-[13px] font-bold text-center ${(scores[p.id] ?? 0) < 0 ? "text-[#b91c1c]" : "text-[#290806]"}`}>
                  {scores[p.id] ?? 0}
                </div>
              ))}
              <div className="w-7" />
            </div>
          </div>
        )}
      </div>

      {/* Undo toast */}
      {undoState && <UndoToast roundNumber={undoState.roundNumber} onUndo={handleUndo} onDismiss={handleDismissUndo} />}
    </div>
  );
}
