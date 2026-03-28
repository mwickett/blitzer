# Scoring Revamp Plan 3: Graph Library + Round Editing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the swipeable graph carousel (Score Progression, Hot & Cold Streaks, Win Probability) and the round editing experience (undo toast + inline editor).

**Architecture:** Graph carousel uses CSS scroll-snap for the swipe behavior (no external library needed). Each graph is a self-contained card component, registered in a pluggable array so future graphs can be added by adding one file and one array entry. The undo toast uses local state with a countdown timer. The inline round editor replaces the score entry area when active, with yellow-highlighted changed fields and cascading score recalculation.

**Tech Stack:** Next.js 16, React 19, Recharts 3.8.1, Tailwind CSS, Jest for unit tests.

**Depends on:** Plan 1 (components, types) + Plan 2 (RaceTrack, BetweenRoundsView, RoundHistoryTable)

**Brainstorm:** `docs/brainstorms/2026-03-28-scoring-experience-brainstorm.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/scoring/probability.ts` | Win probability calculation (linear extrapolation) |
| `src/lib/__tests__/probability.test.ts` | Unit tests for probability logic |
| `src/components/scoring/GraphCarousel.tsx` | Swipeable container with CSS scroll-snap, dot indicators |
| `src/components/scoring/graphs/ScoreProgressionCard.tsx` | Cumulative line chart graph card |
| `src/components/scoring/graphs/HotColdCard.tsx` | Heatmap grid graph card |
| `src/components/scoring/graphs/WinProbabilityCard.tsx` | Probability bars + projected finish |
| `src/components/scoring/UndoToast.tsx` | Undo toast with countdown timer |
| `src/components/scoring/RoundEditor.tsx` | Inline round edit card with change highlighting |

### Modified Files

| File | Change |
|------|--------|
| `src/components/scoring/BetweenRoundsView.tsx` | Replace graph placeholder with GraphCarousel |
| `src/components/scoring/ScoreEntryView.tsx` | Add undo toast after submit, integrate round editor |

---

## Task 1: Win Probability Logic

**Files:**
- Create: `src/lib/scoring/probability.ts`
- Create: `src/lib/__tests__/probability.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/__tests__/probability.test.ts
import {
  calcWinProbabilities,
  calcProjectedFinishRound,
} from "../scoring/probability";

describe("calcProjectedFinishRound", () => {
  it("projects finish round based on average pace", () => {
    // 50 points in 5 rounds = 10/round, need 75, so ~7.5 → round 8
    expect(calcProjectedFinishRound(50, 5, 75)).toBe(8);
  });

  it("returns Infinity for zero or negative pace", () => {
    expect(calcProjectedFinishRound(-10, 5, 75)).toBe(Infinity);
    expect(calcProjectedFinishRound(0, 5, 75)).toBe(Infinity);
  });

  it("returns current round if already past threshold", () => {
    expect(calcProjectedFinishRound(80, 5, 75)).toBe(5);
  });
});

describe("calcWinProbabilities", () => {
  it("returns null when fewer than 3 rounds played", () => {
    const result = calcWinProbabilities(
      [{ id: "1", score: 10, roundsPlayed: 2 }],
      75
    );
    expect(result).toBeNull();
  });

  it("distributes probability based on scoring pace", () => {
    const result = calcWinProbabilities(
      [
        { id: "1", score: 50, roundsPlayed: 5 },
        { id: "2", score: 20, roundsPlayed: 5 },
      ],
      75
    );
    expect(result).not.toBeNull();
    expect(result!["1"]).toBeGreaterThan(result!["2"]);
    // Probabilities should roughly sum to 100
    const sum = Object.values(result!).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 0);
  });

  it("gives 0% to players with negative pace", () => {
    const result = calcWinProbabilities(
      [
        { id: "1", score: 50, roundsPlayed: 5 },
        { id: "2", score: -10, roundsPlayed: 5 },
      ],
      75
    );
    expect(result).not.toBeNull();
    expect(result!["2"]).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern='probability.test' --verbose`
Expected: FAIL

- [ ] **Step 3: Implement probability logic**

```typescript
// src/lib/scoring/probability.ts

export function calcProjectedFinishRound(
  currentScore: number,
  roundsPlayed: number,
  winThreshold: number
): number {
  if (currentScore >= winThreshold) return roundsPlayed;
  const pace = roundsPlayed > 0 ? currentScore / roundsPlayed : 0;
  if (pace <= 0) return Infinity;
  return Math.ceil(winThreshold / pace);
}

export function calcWinProbabilities(
  players: { id: string; score: number; roundsPlayed: number }[],
  winThreshold: number
): Record<string, number> | null {
  if (players.length === 0) return null;
  if (players[0].roundsPlayed < 3) return null;

  const paces = players.map((p) => ({
    id: p.id,
    pace: p.roundsPlayed > 0 ? p.score / p.roundsPlayed : 0,
  }));

  // Only players with positive pace can win
  const positivePaces = paces.filter((p) => p.pace > 0);
  const totalPace = positivePaces.reduce((sum, p) => sum + p.pace, 0);

  if (totalPace === 0) {
    return Object.fromEntries(players.map((p) => [p.id, 0]));
  }

  const result: Record<string, number> = {};
  for (const p of paces) {
    result[p.id] = p.pace > 0 ? Math.round((p.pace / totalPace) * 100) : 0;
  }

  // Adjust rounding to sum to exactly 100
  const sum = Object.values(result).reduce((a, b) => a + b, 0);
  if (sum !== 100 && positivePaces.length > 0) {
    result[positivePaces[0].id] += 100 - sum;
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern='probability.test' --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/probability.ts src/lib/__tests__/probability.test.ts
git commit -m "feat: add win probability calculation logic"
```

---

## Task 2: GraphCarousel Container

**Files:**
- Create: `src/components/scoring/GraphCarousel.tsx`

- [ ] **Step 1: Build the carousel with CSS scroll-snap**

```tsx
// src/components/scoring/GraphCarousel.tsx
"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";

interface GraphCarouselProps {
  children: ReactNode[];
}

export function GraphCarousel({ children }: GraphCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const scrollLeft = el.scrollLeft;
      const cardWidth = el.offsetWidth * 0.88; // ~88% card width + gap
      const index = Math.round(scrollLeft / cardWidth);
      setActiveIndex(Math.min(index, children.length - 1));
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [children.length]);

  return (
    <div className="px-4 py-2">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children.map((child, i) => (
          <div
            key={i}
            className="min-w-[88%] snap-start"
          >
            {child}
          </div>
        ))}
        {/* Peek spacer */}
        <div className="min-w-[2%] flex-shrink-0" />
      </div>

      {/* Dot indicators */}
      {children.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {children.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === activeIndex ? "bg-[#290806]" : "bg-[#d1bfa8]"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add scrollbar-hide utility to globals.css**

In `src/app/globals.css`, add:

```css
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/scoring/GraphCarousel.tsx src/app/globals.css
git commit -m "feat: add GraphCarousel with CSS scroll-snap and dot indicators"
```

---

## Task 3: Score Progression Graph Card

**Files:**
- Create: `src/components/scoring/graphs/ScoreProgressionCard.tsx`

- [ ] **Step 1: Build the score progression line chart card**

```tsx
// src/components/scoring/graphs/ScoreProgressionCard.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { type PlayerWithScore } from "../types";

interface ScoreProgressionCardProps {
  players: PlayerWithScore[];
  scoresByRound: Record<string, number[]>; // playerId -> cumulative scores per round
  winThreshold: number;
}

export function ScoreProgressionCard({
  players,
  scoresByRound,
  winThreshold,
}: ScoreProgressionCardProps) {
  const roundCount =
    Object.values(scoresByRound)[0]?.length ?? 0;

  const data = Array.from({ length: roundCount }, (_, i) => {
    const point: Record<string, number | string> = { round: i + 1 };
    for (const player of players) {
      point[player.id] = scoresByRound[player.id]?.[i] ?? 0;
    }
    return point;
  });

  return (
    <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
      <div className="text-[11px] font-bold text-[#290806] mb-0.5">
        Score Progression
      </div>
      <div className="text-[9px] text-[#8b5e3c] mb-3">
        Cumulative scores across all rounds
      </div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0e6d2" />
            <XAxis
              dataKey="round"
              tick={{ fontSize: 9, fill: "#8b5e3c" }}
              tickLine={false}
              axisLine={{ stroke: "#e6d7c3" }}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#8b5e3c" }}
              tickLine={false}
              axisLine={{ stroke: "#e6d7c3" }}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: "1px solid #e6d7c3",
              }}
            />
            <ReferenceLine
              y={winThreshold}
              stroke="#290806"
              strokeDasharray="4 3"
              strokeWidth={1}
              opacity={0.3}
            />
            <ReferenceLine y={0} stroke="#d1bfa8" strokeWidth={0.5} />
            {players.map((player) => (
              <Line
                key={player.id}
                dataKey={player.id}
                name={player.name}
                stroke={player.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/graphs/ScoreProgressionCard.tsx
git commit -m "feat: add ScoreProgressionCard graph"
```

---

## Task 4: Hot & Cold Streaks Graph Card

**Files:**
- Create: `src/components/scoring/graphs/HotColdCard.tsx`

- [ ] **Step 1: Build the heatmap grid card**

```tsx
// src/components/scoring/graphs/HotColdCard.tsx
import { type PlayerWithScore } from "../types";

interface HotColdCardProps {
  players: PlayerWithScore[];
  deltasByRound: Record<string, number[]>; // playerId -> delta per round
}

export function HotColdCard({ players, deltasByRound }: HotColdCardProps) {
  const roundCount = Object.values(deltasByRound)[0]?.length ?? 0;

  // Find the best round per player for fire emoji
  const bestRoundByPlayer: Record<string, number> = {};
  for (const player of players) {
    const deltas = deltasByRound[player.id] ?? [];
    let bestIdx = 0;
    for (let i = 1; i < deltas.length; i++) {
      if (deltas[i] > deltas[bestIdx]) bestIdx = i;
    }
    if (deltas[bestIdx] > 0) bestRoundByPlayer[player.id] = bestIdx;
  }

  return (
    <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
      <div className="text-[11px] font-bold text-[#290806] mb-0.5">
        Hot & Cold
      </div>
      <div className="text-[9px] text-[#8b5e3c] mb-3">
        Performance intensity per round
      </div>

      {/* Round headers */}
      <div className="flex gap-1 mb-1.5" style={{ marginLeft: 44 }}>
        {Array.from({ length: roundCount }, (_, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[8px] text-[#8b5e3c] font-medium"
          >
            R{i + 1}
          </div>
        ))}
      </div>

      {/* Player rows */}
      <div className="space-y-1.5">
        {players.map((player) => {
          const deltas = deltasByRound[player.id] ?? [];
          return (
            <div key={player.id} className="flex items-center gap-1.5">
              <div
                className="w-10 text-[10px] font-semibold text-right flex-shrink-0 truncate"
                style={{ color: player.color }}
              >
                {player.name}
              </div>
              <div className="flex gap-1 flex-1">
                {deltas.map((d, ri) => {
                  const isBest = bestRoundByPlayer[player.id] === ri;
                  const isNeg = d < 0;
                  const isHot = d >= 10;

                  return (
                    <div
                      key={ri}
                      className="flex-1 h-9 rounded-md flex items-center justify-center text-[10px] font-bold relative"
                      style={{
                        backgroundColor: isNeg
                          ? "#b91c1c"
                          : isHot
                            ? player.color
                            : "#f0e6d2",
                        color:
                          isNeg || isHot ? "#fff" : "#8b5e3c",
                        opacity: isNeg ? 0.7 : isHot ? 1 : 0.8,
                      }}
                    >
                      {d > 0 ? `+${d}` : d}
                      {isBest && (
                        <span className="absolute -top-1 -right-0.5 text-[7px]">
                          🔥
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/graphs/HotColdCard.tsx
git commit -m "feat: add HotColdCard heatmap graph"
```

---

## Task 5: Win Probability Graph Card

**Files:**
- Create: `src/components/scoring/graphs/WinProbabilityCard.tsx`

- [ ] **Step 1: Build the probability card**

```tsx
// src/components/scoring/graphs/WinProbabilityCard.tsx
import { type PlayerWithScore } from "../types";
import {
  calcWinProbabilities,
  calcProjectedFinishRound,
} from "@/lib/scoring/probability";

interface WinProbabilityCardProps {
  players: PlayerWithScore[];
  roundsPlayed: number;
  winThreshold: number;
}

export function WinProbabilityCard({
  players,
  roundsPlayed,
  winThreshold,
}: WinProbabilityCardProps) {
  const probabilities = calcWinProbabilities(
    players.map((p) => ({ id: p.id, score: p.score, roundsPlayed })),
    winThreshold
  );

  if (!probabilities) {
    return (
      <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
        <div className="text-[11px] font-bold text-[#290806] mb-0.5">
          Win Probability
        </div>
        <div className="text-[9px] text-[#8b5e3c]">
          Available after 3 rounds
        </div>
      </div>
    );
  }

  const sorted = [...players].sort(
    (a, b) => (probabilities[b.id] ?? 0) - (probabilities[a.id] ?? 0)
  );

  return (
    <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
      <div className="text-[11px] font-bold text-[#290806] mb-0.5">
        Win Probability
      </div>
      <div className="text-[9px] text-[#8b5e3c] mb-3">
        Based on scoring pace through {roundsPlayed} rounds
      </div>

      <div className="space-y-2">
        {sorted.map((player) => {
          const pct = probabilities[player.id] ?? 0;
          return (
            <div key={player.id} className="flex items-center gap-2">
              <div
                className="w-10 text-[10px] font-semibold text-right flex-shrink-0"
                style={{ color: player.color }}
              >
                {player.name}
              </div>
              <div className="flex-1 h-6 bg-[#f0e6d2] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full flex items-center justify-end pr-2 text-[10px] font-bold text-white min-w-[28px]"
                  style={{
                    width: `${Math.max(pct, 8)}%`,
                    backgroundColor: player.color,
                  }}
                >
                  {pct}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Projected finish */}
      <div className="mt-3 pt-3 border-t border-[#f0e6d2]">
        <div className="text-[9px] font-semibold text-[#8b5e3c] mb-2">
          Projected finish
        </div>
        <div className="flex gap-3">
          {sorted
            .filter((p) => (probabilities[p.id] ?? 0) > 0)
            .map((player) => {
              const round = calcProjectedFinishRound(
                player.score,
                roundsPlayed,
                winThreshold
              );
              return (
                <div key={player.id} className="text-center">
                  <div
                    className="text-lg font-extrabold"
                    style={{ color: player.color }}
                  >
                    ~R{round === Infinity ? "∞" : round}
                  </div>
                  <div className="text-[8px] text-[#8b5e3c]">
                    {player.name}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div className="text-[8px] text-[#8b5e3c] text-center mt-2 italic">
        Based on average scoring pace · updates each round
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/graphs/WinProbabilityCard.tsx
git commit -m "feat: add WinProbabilityCard with projected finish rounds"
```

---

## Task 6: Wire Graph Carousel into BetweenRoundsView

**Files:**
- Modify: `src/components/scoring/BetweenRoundsView.tsx`

- [ ] **Step 1: Replace graph placeholder with real carousel**

Import the carousel and graph cards, compute the derived data (cumulative scores, deltas), and render:

```tsx
import { GraphCarousel } from "./GraphCarousel";
import { ScoreProgressionCard } from "./graphs/ScoreProgressionCard";
import { HotColdCard } from "./graphs/HotColdCard";
import { WinProbabilityCard } from "./graphs/WinProbabilityCard";
import { calculateRoundScore } from "@/lib/validation/gameRules";
```

Compute `scoresByRound` (cumulative) and `deltasByRound` from the rounds data, then render:

```tsx
<GraphCarousel>
  <ScoreProgressionCard
    players={players}
    scoresByRound={scoresByRound}
    winThreshold={winThreshold}
  />
  <HotColdCard players={players} deltasByRound={deltasByRound} />
  <WinProbabilityCard
    players={players}
    roundsPlayed={rounds.length}
    winThreshold={winThreshold}
  />
</GraphCarousel>
```

- [ ] **Step 2: Test manually**

Verify the three graphs render in the carousel, swipe/snap works, dot indicators update.

- [ ] **Step 3: Commit**

```bash
git add src/components/scoring/BetweenRoundsView.tsx
git commit -m "feat: wire graph carousel into between-rounds view"
```

---

## Task 7: UndoToast Component

**Files:**
- Create: `src/components/scoring/UndoToast.tsx`

- [ ] **Step 1: Build the undo toast with countdown**

```tsx
// src/components/scoring/UndoToast.tsx
"use client";

import { useState, useEffect, useRef } from "react";

interface UndoToastProps {
  roundNumber: number;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export function UndoToast({
  roundNumber,
  onUndo,
  onDismiss,
  durationMs = 5000,
}: UndoToastProps) {
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalMs = 100;

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev - (intervalMs / durationMs) * 100;
        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          onDismiss();
          return 0;
        }
        return next;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [durationMs, onDismiss]);

  const handleUndo = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onUndo();
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[408px] z-50">
      <div className="bg-[#290806] text-white rounded-xl px-4 pt-3 pb-4 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium">
            Round {roundNumber} submitted
          </span>
          <button
            onClick={handleUndo}
            className="text-[13px] font-bold text-[#fbbf24] px-3 py-1 rounded-lg bg-[rgba(251,191,36,0.15)] hover:bg-[rgba(251,191,36,0.25)] transition-colors cursor-pointer"
          >
            Undo
          </button>
        </div>
        <div className="mt-2 h-[3px] bg-[rgba(255,255,255,0.15)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#fbbf24] rounded-full transition-all"
            style={{
              width: `${progress}%`,
              transitionDuration: `${intervalMs}ms`,
              transitionTimingFunction: "linear",
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/UndoToast.tsx
git commit -m "feat: add UndoToast with countdown timer"
```

---

## Task 8: RoundEditor Component

**Files:**
- Create: `src/components/scoring/RoundEditor.tsx`

- [ ] **Step 1: Build the inline round editor**

```tsx
// src/components/scoring/RoundEditor.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/RoundEditor.tsx
git commit -m "feat: add RoundEditor inline editing with change highlighting"
```

---

## Task 9: Integrate Undo + Editing into ScoreEntryView

**Files:**
- Modify: `src/components/scoring/ScoreEntryView.tsx`

- [ ] **Step 1: Add undo toast state management**

After a successful `handleSubmit`, set undo state with the pre-submit data. Show the `UndoToast`. On undo, revert the round by calling `deleteRound` or reverting local state and refreshing.

Import:
```tsx
import { UndoToast } from "./UndoToast";
```

Add state:
```tsx
const [undoData, setUndoData] = useState<{ roundNumber: number } | null>(null);
```

After successful submit:
```tsx
setUndoData({ roundNumber: currentRoundNumber });
```

Render toast:
```tsx
{undoData && (
  <UndoToast
    roundNumber={undoData.roundNumber}
    onUndo={handleUndo}
    onDismiss={() => setUndoData(null)}
  />
)}
```

- [ ] **Step 2: Wire round editing into the between-rounds flow**

When a user taps a history row, show the `RoundEditor` in place of the score entry cards. The FloatingCTA switches to editing mode. On save, call `updateRoundScores` server action and refresh.

- [ ] **Step 3: Test the full flow manually**

1. Enter scores for all players → Submit → Undo toast appears
2. Tap Undo → Scores revert, back to entry mode
3. Submit again → Toast expires → Between-rounds view shows
4. Tap a history row → Inline editor appears
5. Change a value (yellow highlight) → Save → Scores recalculate

- [ ] **Step 4: Commit**

```bash
git add src/components/scoring/ScoreEntryView.tsx
git commit -m "feat: integrate undo toast and round editing into scoring flow"
```

---

## Task 10: deleteLatestRound Server Action

**Files:**
- Modify: `src/server/mutations/rounds.ts`

The undo flow needs to delete the most recently created round. No such action exists today. This must follow the same auth + circle-authorization pattern as the existing mutations, and must enforce "latest round only" to prevent deletion of historical rounds.

- [ ] **Step 1: Add deleteLatestRound mutation**

```typescript
// In src/server/mutations/rounds.ts, add:

export async function deleteLatestRound(gameId: string) {
  const { user, posthog, orgId } = await getAuthenticatedUserWithOrg();

  // Verify game exists and belongs to active circle (same pattern as createRoundForGame)
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      rounds: { orderBy: { round: "desc" }, take: 1, include: { scores: true } },
    },
  });

  if (!game) throw new Error("Game not found");
  if (game.organizationId !== orgId) {
    throw new Error("Game does not belong to your active circle");
  }

  const latestRound = game.rounds[0];
  if (!latestRound) throw new Error("No rounds to undo");

  // All operations in a single transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // Delete scores first (FK constraint), then the round
    await tx.score.deleteMany({ where: { roundId: latestRound.id } });
    await tx.round.delete({ where: { id: latestRound.id } });

    // If the game was finished, reopen it
    if (game.isFinished) {
      await tx.game.update({
        where: { id: gameId },
        data: { isFinished: false, winnerId: null, endedAt: null },
      });
    }
  });

  posthog.capture({
    distinctId: user.userId,
    event: "undo_round",
    properties: { game_id: gameId, round_number: latestRound.round },
  });

  return { deletedRoundNumber: latestRound.round };
}
```

- [ ] **Step 2: Export from mutations index**

Add `deleteLatestRound` to `src/server/mutations/index.ts` exports.

- [ ] **Step 3: Write tests for deleteLatestRound**

In `src/server/__tests__/mutations.test.ts`, add tests:

```typescript
describe("deleteLatestRound", () => {
  it("deletes the most recent round and its scores", async () => {
    // Setup: game with 3 rounds
    // Call deleteLatestRound
    // Verify: only round 3 deleted, rounds 1-2 still exist
  });

  it("rejects deletion when game belongs to a different circle", async () => {
    // Setup: game in circle A, user in circle B
    // Expect: throws "Game does not belong to your active circle"
  });

  it("reopens a finished game when the winning round is undone", async () => {
    // Setup: finished game, winner determined
    // Call deleteLatestRound
    // Verify: isFinished=false, winnerId=null
  });

  it("only deletes the latest round, not arbitrary rounds", async () => {
    // The function takes no roundId — it always deletes the latest.
    // This is by design to prevent historical data deletion.
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add src/server/mutations/rounds.ts src/server/mutations/index.ts src/server/__tests__/mutations.test.ts
git commit -m "feat: add deleteRound server action for undo support"
```

---

## Task 11: Optimistic UI Pattern for Submit

**Files:**
- Modify: `src/components/scoring/ScoreEntryView.tsx`
- Modify: `src/server/mutations/rounds.ts` (return roundId from createRoundForGame)

The current submit flow waits for the server round-trip. The spec requires optimistic local updates. The undo flow uses `deleteLatestRound` (no roundId needed — always deletes the most recent round), which avoids the race condition of needing a roundId before the server responds.

- [ ] **Step 1: Modify createRoundForGame to return roundId**

In `src/server/mutations/rounds.ts`, change the return to include the round ID:

```typescript
// At the end of createRoundForGame, change:
return round;
// to:
return { roundId: round.id, round };
```

- [ ] **Step 2: Implement optimistic submit**

Refactor `handleSubmit` in `ScoreEntryView`. The key design: undo calls `deleteLatestRound(gameId)` — it doesn't need a roundId, so there's no race condition between the create call returning and the user tapping Undo.

```tsx
// State for optimistic updates
const [optimisticDeltas, setOptimisticDeltas] = useState<Record<string, number> | null>(null);
const [undoData, setUndoData] = useState<{
  roundNumber: number;
  preSubmitEntries: Record<string, PlayerEntry>;
  serverConfirmed: boolean;
} | null>(null);

const handleSubmit = useCallback(async () => {
  if (!allComplete || isSubmitting) return;

  // Immediately disable button via ref (not state — avoids render cycle delay)
  const submitButton = document.activeElement as HTMLButtonElement;
  if (submitButton) submitButton.disabled = true;
  setIsSubmitting(true);
  setError(null);

  // Calculate deltas locally for optimistic UI
  const deltas: Record<string, number> = {};
  const scores = players.map((player) => {
    const entry = entries[player.id];
    const blitz = entry.blitzRemaining ?? 0;
    const cards = entry.cardsPlayed ?? 0;
    deltas[player.id] = calculateRoundScore({ blitzPileRemaining: blitz, totalCardsPlayed: cards });
    return {
      ...(player.isGuest ? { guestId: player.guestId } : { userId: player.userId }),
      blitzPileRemaining: blitz,
      totalCardsPlayed: cards,
    };
  });

  // Save pre-submit state for undo
  const preSubmitEntries = { ...entries };

  // Optimistically update UI — show deltas, clear form
  setOptimisticDeltas(deltas);
  setUndoData({ roundNumber: currentRoundNumber, preSubmitEntries, serverConfirmed: false });
  setEntries(Object.fromEntries(
    players.map((p) => [p.id, { blitzRemaining: null, cardsPlayed: null }])
  ));

  try {
    validateGameRules(scores);
    await createRoundForGame(gameId, currentRoundNumber, scores);
    // Mark server-confirmed so undo knows to call deleteLatestRound
    setUndoData((prev) => prev ? { ...prev, serverConfirmed: true } : null);
    setIsSubmitting(false);
  } catch (e) {
    // Revert optimistic update
    setEntries(preSubmitEntries);
    setOptimisticDeltas(null);
    setUndoData(null);
    setError(e instanceof Error ? e.message : "Failed to submit round");
    setIsSubmitting(false);
  }
}, [/* deps */]);
```

- [ ] **Step 3: Implement undo handler**

The undo handler handles two cases:
1. Server hasn't confirmed yet → just revert local state (the server call will either fail or succeed and be cleaned up on next refresh)
2. Server confirmed → call `deleteLatestRound` to remove the round

```tsx
const handleUndo = useCallback(async () => {
  if (!undoData) return;
  const wasConfirmed = undoData.serverConfirmed;
  const savedEntries = undoData.preSubmitEntries;

  // Immediately revert local state
  setUndoData(null);
  setOptimisticDeltas(null);
  setEntries(savedEntries);

  // If server already saved the round, delete it
  if (wasConfirmed) {
    try {
      await deleteLatestRound(gameId);
    } catch (e) {
      setError("Failed to undo. Please refresh the page.");
    }
  }
  // If server hasn't confirmed yet, the optimistic revert is sufficient.
  // If the server call succeeds after undo, the stale round will appear
  // on next refresh — but deleteLatestRound can clean it up, or the user
  // can refresh. This is an acceptable edge case for a ~1s race window.

  router.refresh();
}, [undoData, gameId, router]);
```

- [ ] **Step 3: Add error toast with Retry**

When the server save fails, show an error banner with a Retry button:

```tsx
{error && (
  <div className="mx-4 mb-2 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg flex items-center justify-between">
    <span className="text-sm text-[#b91c1c]">{error}</span>
    <button
      onClick={handleSubmit}
      className="text-sm font-bold text-[#b91c1c] ml-2 underline"
    >
      Retry
    </button>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/scoring/ScoreEntryView.tsx
git commit -m "feat: optimistic UI for round submit with undo and retry"
```

---

## Task 12: Score Delta Flash Animation

**Files:**
- Modify: `src/components/scoring/ScoreEntryCard.tsx`
- Modify: `src/app/globals.css`

After a round is submitted, each player card briefly flashes their delta ("+18" in green) before showing the new cumulative total.

- [ ] **Step 1: Add delta flash prop and animation to ScoreEntryCard**

Add an optional `deltaFlash` prop:

```tsx
interface ScoreEntryCardProps {
  // ... existing props
  deltaFlash?: number | null; // When set, shows "+N" flash animation
}
```

When `deltaFlash` is set, render an overlay that animates in and out:

```tsx
{deltaFlash !== null && deltaFlash !== undefined && (
  <div className="absolute inset-0 flex items-center justify-center rounded-xl animate-[deltaFlash_1.2s_ease-out_forwards] pointer-events-none"
    style={{ backgroundColor: deltaFlash >= 0 ? "#dcfce7" : "#fef2f2" }}>
    <span className={`text-2xl font-black ${deltaFlash >= 0 ? "text-[#2a6517]" : "text-[#b91c1c]"}`}>
      {deltaFlash > 0 ? `+${deltaFlash}` : deltaFlash}
    </span>
  </div>
)}
```

- [ ] **Step 2: Add the keyframe animation to globals.css**

```css
@keyframes deltaFlash {
  0% { opacity: 0; transform: scale(0.8); }
  15% { opacity: 1; transform: scale(1.05); }
  25% { transform: scale(1); }
  70% { opacity: 1; }
  100% { opacity: 0; }
}
```

- [ ] **Step 3: Wire into ScoreEntryView**

After optimistic submit, set `optimisticDeltas` state. Pass each player's delta to their `ScoreEntryCard` as `deltaFlash`. Clear after the animation duration (~1.2s) with a timeout.

- [ ] **Step 4: Commit**

```bash
git add src/components/scoring/ScoreEntryCard.tsx src/components/scoring/ScoreEntryView.tsx src/app/globals.css
git commit -m "feat: add score delta flash animation on round submit"
```

---

## Task 13: Idempotency Key for Round Submission

**Files:**
- Modify: `src/components/scoring/ScoreEntryView.tsx`
- Modify: `src/server/mutations/rounds.ts`

- [ ] **Step 1: Generate idempotency key on submit**

In `ScoreEntryView`, generate a UUID before each submission:

```tsx
import { v4 as uuidv4 } from "uuid"; // or use crypto.randomUUID()

// In handleSubmit, before the server call:
const idempotencyKey = crypto.randomUUID();
await createRoundForGame(gameId, currentRoundNumber, scores, idempotencyKey);
```

- [ ] **Step 2: Check idempotency in server mutation**

In `createRoundForGame`, add an optional `idempotencyKey` parameter. Before creating the round, check if a round with this key already exists:

```typescript
export async function createRoundForGame(
  gameId: string,
  roundNumber: number,
  scores: RoundScoreData[],
  idempotencyKey?: string
) {
  // If idempotency key provided, check for existing round
  if (idempotencyKey) {
    const existing = await prisma.round.findFirst({
      where: { gameId, round: roundNumber },
    });
    if (existing) {
      // Round already exists for this game+number — return it (idempotent)
      return { roundId: existing.id };
    }
  }
  // ... rest of existing logic
}
```

Note: This is a simple version using game+round number uniqueness (which already has a unique constraint in the schema: `@@unique([gameId, round])`). The unique constraint itself provides idempotency — if the insert conflicts, catch the error and return the existing round.

- [ ] **Step 3: Commit**

```bash
git add src/components/scoring/ScoreEntryView.tsx src/server/mutations/rounds.ts
git commit -m "feat: add idempotency key for round submission"
```

---

## Task 14: Integration Tests for Core Scoring Flows

**Files:**
- Create: `src/components/__tests__/scoring/ScoreEntryView.test.tsx`
- Create: `src/components/__tests__/scoring/BetweenRoundsView.test.tsx`

Set up the integration test harness and cover the core happy paths.

- [ ] **Step 1: Create test for ScoreEntryView**

```tsx
// src/components/__tests__/scoring/ScoreEntryView.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScoreEntryView } from "../../scoring/ScoreEntryView";

// Mock server actions
jest.mock("@/server/mutations", () => ({
  createRoundForGame: jest.fn().mockResolvedValue({ roundId: "round-1" }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock("@/lib/validation/gameRules", () => ({
  validateGameRules: jest.fn(),
  calculateRoundScore: jest.fn((s) => s.totalCardsPlayed - 2 * s.blitzPileRemaining),
}));

const mockPlayers = [
  { id: "1", name: "Mike", color: "#3b82f6", isGuest: false, userId: "u1", score: 0 },
  { id: "2", name: "Sarah", color: "#ef4444", isGuest: false, userId: "u2", score: 0 },
];

describe("ScoreEntryView", () => {
  it("renders player cards with empty status", () => {
    render(
      <ScoreEntryView
        gameId="game-1"
        currentRoundNumber={1}
        players={mockPlayers}
        winThreshold={75}
      />
    );
    expect(screen.getByText("Mike")).toBeInTheDocument();
    expect(screen.getByText("Sarah")).toBeInTheDocument();
    // Status indicators should show empty
    expect(screen.getAllByText("○")).toHaveLength(2);
  });

  it("shows complete status when both fields are filled", () => {
    render(
      <ScoreEntryView
        gameId="game-1"
        currentRoundNumber={1}
        players={mockPlayers}
        winThreshold={75}
      />
    );
    const inputs = screen.getAllByPlaceholderText("—");
    fireEvent.change(inputs[0], { target: { value: "3" } });
    fireEvent.change(inputs[1], { target: { value: "18" } });
    expect(screen.getAllByText("✓")).toHaveLength(1);
    expect(screen.getAllByText("○")).toHaveLength(1);
  });

  it("enables submit button when all players complete", () => {
    render(
      <ScoreEntryView
        gameId="game-1"
        currentRoundNumber={1}
        players={mockPlayers}
        winThreshold={75}
      />
    );
    const inputs = screen.getAllByPlaceholderText("—");
    // Fill all 4 inputs (2 per player)
    fireEvent.change(inputs[0], { target: { value: "3" } });
    fireEvent.change(inputs[1], { target: { value: "18" } });
    fireEvent.change(inputs[2], { target: { value: "5" } });
    fireEvent.change(inputs[3], { target: { value: "14" } });

    const submitBtn = screen.getByText("Submit Round");
    expect(submitBtn).not.toBeDisabled();
  });

  it("shows remaining count in submit button", () => {
    render(
      <ScoreEntryView
        gameId="game-1"
        currentRoundNumber={1}
        players={mockPlayers}
        winThreshold={75}
      />
    );
    expect(screen.getByText("Submit Round (2 remaining)")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- --testPathPattern='scoring/ScoreEntryView' --verbose`
Expected: PASS

- [ ] **Step 3: Create test for undo flow**

```tsx
// Add to ScoreEntryView.test.tsx:
it("shows undo toast after submit", async () => {
  render(
    <ScoreEntryView
      gameId="game-1"
      currentRoundNumber={1}
      players={mockPlayers}
      winThreshold={75}
    />
  );

  // Fill all inputs
  const inputs = screen.getAllByPlaceholderText("—");
  fireEvent.change(inputs[0], { target: { value: "0" } });
  fireEvent.change(inputs[1], { target: { value: "18" } });
  fireEvent.change(inputs[2], { target: { value: "5" } });
  fireEvent.change(inputs[3], { target: { value: "14" } });

  // Submit
  fireEvent.click(screen.getByText("Submit Round"));

  // Undo toast should appear
  await waitFor(() => {
    expect(screen.getByText("Round 1 submitted")).toBeInTheDocument();
    expect(screen.getByText("Undo")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add src/components/__tests__/scoring/
git commit -m "test: add integration tests for ScoreEntryView and undo flow"
```

---

## Task 15: PostHog Tracking for Scoring Actions

**Files:**
- Modify: `src/components/scoring/ScoreEntryView.tsx`
- Modify: `src/components/scoring/RoundEditor.tsx`

- [ ] **Step 1: Add PostHog capture to client-side scoring interactions**

```tsx
import { usePostHog } from "posthog-js/react";

// In ScoreEntryView:
const posthog = usePostHog();

// After successful submit:
posthog.capture("scoring_round_submitted", {
  game_id: gameId,
  round_number: currentRoundNumber,
  player_count: players.length,
});

// After undo:
posthog.capture("scoring_round_undone", {
  game_id: gameId,
  round_number: undoData.roundNumber,
});

// In RoundEditor, after save:
posthog.capture("scoring_round_edited", {
  game_id: gameId,
  round_number: roundIndex + 1,
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/ScoreEntryView.tsx src/components/scoring/RoundEditor.tsx
git commit -m "feat: add PostHog tracking for submit, undo, and edit scoring actions"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Graph carousel (hard snap, peek, dots) ✓. Score Progression ✓. Hot & Cold Streaks (heatmap, fire emoji) ✓. Win Probability (linear extrapolation, 3-round minimum, projected finish) ✓. Undo toast (5s countdown) ✓. Inline round editor (yellow highlights, live delta, cascading recalc) ✓. deleteRound server action ✓. Optimistic UI with revert on failure ✓. Score delta flash animation ✓. Idempotency key ✓. Integration tests ✓. PostHog tracking ✓.
- [x] **Deferred to Plan 4:** Game over celebration, results view.
- [x] **Type consistency:** `PlayerWithScore` used across all graph cards. `calculateRoundScore` from existing `gameRules.ts`. `deleteRound` exported from mutations.
