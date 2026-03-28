# Scoring Revamp Plan 2: Race Track + Between Rounds

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the stacking pills race track component and the between-rounds display layout (Track → Graphs → Standings → Score Table).

**Architecture:** Extract the race track pill-grouping logic as pure functions in `src/lib/scoring/racetrack.ts` (fully testable), build the React component in `src/components/scoring/RaceTrack.tsx`, then compose the between-rounds view with standings list and score table. The race track is designed as a pluggable component — the pill grouping strategy can be swapped later.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS, Jest for unit tests.

**Depends on:** Plan 1 (accent colors, shared types, component structure)

**Brainstorm:** `docs/brainstorms/2026-03-28-scoring-experience-brainstorm.md`
**Workbench reference:** `src/app/dev/workbench/page.tsx` (has working RaceTrack prototype)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/scoring/racetrack.ts` | Pure functions: score-to-position mapping, pill grouping algorithm, dynamic bounds calculation |
| `src/lib/__tests__/racetrack.test.ts` | Unit tests for all racetrack logic including edge cases (negatives, clustering, dynamic scaling) |
| `src/components/scoring/RaceTrack.tsx` | Stacking pills visualization component |
| `src/components/scoring/Standings.tsx` | Ranked standings list with "X away" labels |
| `src/components/scoring/RoundHistoryTable.tsx` | Score table with tappable rows (pencil icons, "tap to edit" hint) |
| `src/components/scoring/BetweenRoundsView.tsx` | Composed between-rounds layout: Track → Graphs placeholder → Standings → Table |

### Modified Files

| File | Change |
|------|--------|
| `src/app/games/[id]/page.tsx` | Add between-rounds view (conditional on game state + feature flag) |
| `src/app/dev/workbench/page.tsx` | Import shared RaceTrack instead of inline copy |

---

## Task 1: Race Track Pure Logic

**Files:**
- Create: `src/lib/scoring/racetrack.ts`
- Create: `src/lib/__tests__/racetrack.test.ts`

- [ ] **Step 1: Write failing tests for racetrack logic**

```typescript
// src/lib/__tests__/racetrack.test.ts
import {
  calcTrackBounds,
  scoreToPosition,
  groupMarkers,
  type TrackMarker,
} from "../scoring/racetrack";

describe("calcTrackBounds", () => {
  it("uses default min of -10 when all scores are positive", () => {
    const bounds = calcTrackBounds([10, 20, 30], 75);
    expect(bounds.min).toBe(-10);
    expect(bounds.max).toBe(75);
  });

  it("expands min when a player is below -10", () => {
    const bounds = calcTrackBounds([-15, 20, 30], 75);
    expect(bounds.min).toBe(-20); // -15 - 5
  });

  it("uses custom win threshold as max", () => {
    const bounds = calcTrackBounds([10, 20], 50);
    expect(bounds.max).toBe(50);
  });
});

describe("scoreToPosition", () => {
  it("maps min score to 0%", () => {
    expect(scoreToPosition(-10, -10, 75)).toBe(0);
  });

  it("maps max score to 100%", () => {
    expect(scoreToPosition(75, -10, 75)).toBe(100);
  });

  it("maps zero correctly within range", () => {
    const pos = scoreToPosition(0, -20, 80);
    expect(pos).toBe(20); // 20/100 = 20%
  });

  it("returns 50 when range is zero", () => {
    expect(scoreToPosition(5, 5, 5)).toBe(50);
  });
});

describe("groupMarkers", () => {
  it("keeps spread markers as individual groups", () => {
    const markers: TrackMarker[] = [
      { id: "1", name: "A", score: 10, color: "#3b82f6" },
      { id: "2", name: "B", score: 50, color: "#ef4444" },
    ];
    const groups = groupMarkers(markers, 8, -10, 75);
    expect(groups).toHaveLength(2);
    expect(groups[0].markers).toHaveLength(1);
    expect(groups[1].markers).toHaveLength(1);
  });

  it("merges close markers into a single pill", () => {
    const markers: TrackMarker[] = [
      { id: "1", name: "A", score: 10, color: "#3b82f6" },
      { id: "2", name: "B", score: 12, color: "#ef4444" },
    ];
    const groups = groupMarkers(markers, 8, -10, 75);
    expect(groups).toHaveLength(1);
    expect(groups[0].markers).toHaveLength(2);
  });

  it("merges all markers when extremely clustered", () => {
    const markers: TrackMarker[] = [
      { id: "1", name: "A", score: 0, color: "#3b82f6" },
      { id: "2", name: "B", score: 1, color: "#ef4444" },
      { id: "3", name: "C", score: 2, color: "#eab308" },
      { id: "4", name: "D", score: 3, color: "#22c55e" },
    ];
    const groups = groupMarkers(markers, 8, -10, 75);
    expect(groups).toHaveLength(1);
    expect(groups[0].markers).toHaveLength(4);
  });

  it("handles negative scores", () => {
    const markers: TrackMarker[] = [
      { id: "1", name: "A", score: -8, color: "#3b82f6" },
      { id: "2", name: "B", score: 20, color: "#ef4444" },
    ];
    const groups = groupMarkers(markers, 8, -20, 75);
    expect(groups).toHaveLength(2);
    expect(groups[0].markers[0].score).toBe(-8);
  });

  it("returns empty array for empty input", () => {
    expect(groupMarkers([], 8, -10, 75)).toHaveLength(0);
  });

  it("sorts markers by score within groups", () => {
    const markers: TrackMarker[] = [
      { id: "1", name: "A", score: 5, color: "#3b82f6" },
      { id: "2", name: "B", score: 3, color: "#ef4444" },
    ];
    const groups = groupMarkers(markers, 8, -10, 75);
    expect(groups[0].markers[0].score).toBe(3);
    expect(groups[0].markers[1].score).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern='racetrack.test' --verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement racetrack logic**

```typescript
// src/lib/scoring/racetrack.ts

export interface TrackMarker {
  id: string;
  name: string;
  score: number;
  color: string;
}

export interface PillGroup {
  markers: TrackMarker[];
  position: number; // percentage 0-100
}

export function calcTrackBounds(
  scores: number[],
  winThreshold: number
): { min: number; max: number } {
  const lowest = scores.length > 0 ? Math.min(...scores) : 0;
  return {
    min: Math.min(lowest - 5, -10),
    max: winThreshold,
  };
}

export function scoreToPosition(
  score: number,
  min: number,
  max: number
): number {
  const range = max - min;
  if (range === 0) return 50;
  return ((score - min) / range) * 100;
}

export function groupMarkers(
  markers: TrackMarker[],
  threshold: number,
  trackMin: number,
  trackMax: number
): PillGroup[] {
  if (markers.length === 0) return [];

  const sorted = [...markers].sort((a, b) => a.score - b.score);
  const groups: PillGroup[] = [];
  let current: TrackMarker[] = [sorted[0]];
  let currentPos = scoreToPosition(sorted[0].score, trackMin, trackMax);

  for (let i = 1; i < sorted.length; i++) {
    const pos = scoreToPosition(sorted[i].score, trackMin, trackMax);
    if (pos - currentPos < threshold) {
      current.push(sorted[i]);
    } else {
      const avg =
        current.reduce((s, m) => s + m.score, 0) / current.length;
      groups.push({
        markers: current,
        position: scoreToPosition(avg, trackMin, trackMax),
      });
      current = [sorted[i]];
      currentPos = pos;
    }
  }

  const avg = current.reduce((s, m) => s + m.score, 0) / current.length;
  groups.push({
    markers: current,
    position: scoreToPosition(avg, trackMin, trackMax),
  });

  return groups;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern='racetrack.test' --verbose`
Expected: PASS — all tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/racetrack.ts src/lib/__tests__/racetrack.test.ts
git commit -m "feat: add racetrack pure logic — bounds, positioning, pill grouping"
```

---

## Task 2: RaceTrack React Component

**Files:**
- Create: `src/components/scoring/RaceTrack.tsx`

- [ ] **Step 1: Build the RaceTrack component**

```tsx
// src/components/scoring/RaceTrack.tsx
"use client";

import {
  calcTrackBounds,
  scoreToPosition,
  groupMarkers,
  type TrackMarker,
} from "@/lib/scoring/racetrack";
import { type PlayerWithScore } from "./types";

interface RaceTrackProps {
  players: PlayerWithScore[];
  winThreshold?: number;
  pillThreshold?: number;
}

export function RaceTrack({
  players,
  winThreshold = 75,
  pillThreshold = 8,
}: RaceTrackProps) {
  const scores = players.map((p) => p.score);
  const bounds = calcTrackBounds(scores, winThreshold);
  const zeroPos = scoreToPosition(0, bounds.min, bounds.max);

  const markers: TrackMarker[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    color: p.color,
  }));

  const groups = groupMarkers(markers, pillThreshold, bounds.min, bounds.max);

  return (
    <div className="w-full">
      <div className="flex justify-between text-[9px] text-[#8b5e3c] mb-1.5 px-0.5">
        <span>{bounds.min}</span>
        <span>{winThreshold} to win</span>
      </div>

      <div className="relative h-10 bg-[#f0e6d2] rounded-full overflow-visible">
        {/* Zero line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-[#d1bfa8]"
          style={{ left: `${zeroPos}%` }}
        />
        <div
          className="absolute -top-4 text-[8px] text-[#8b5e3c] -translate-x-1/2"
          style={{ left: `${zeroPos}%` }}
        >
          0
        </div>

        {/* Finish line */}
        <div className="absolute top-0 bottom-0 w-[3px] bg-[#290806] right-0 rounded-r-full" />
        <div className="absolute -top-4 right-[-2px] text-[10px]">🏁</div>

        {/* Pill groups */}
        {groups.map((group, gi) => {
          const pos = Math.max(3, Math.min(97, group.position));

          if (group.markers.length === 1) {
            const m = group.markers[0];
            return (
              <div
                key={gi}
                className="absolute top-1/2 z-10 transition-all duration-300"
                style={{
                  left: `${pos}%`,
                  transform: "translateX(-50%) translateY(-50%)",
                }}
              >
                <div
                  className="w-7 h-7 rounded-full border-[2.5px] border-[#fff7ea] shadow-sm flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ backgroundColor: m.color }}
                >
                  {m.score}
                </div>
                <div
                  className="absolute top-8 left-1/2 -translate-x-1/2 text-[8px] font-semibold whitespace-nowrap"
                  style={{ color: m.score < 0 ? "#b91c1c" : m.color }}
                >
                  {m.name}
                </div>
              </div>
            );
          }

          return (
            <div
              key={gi}
              className="absolute top-1/2 z-10 transition-all duration-300"
              style={{
                left: `${pos}%`,
                transform: "translateX(-50%) translateY(-50%)",
              }}
            >
              <div className="flex h-7 rounded-full border-[2.5px] border-[#fff7ea] shadow-sm overflow-hidden">
                {group.markers.map((m) => (
                  <div
                    key={m.id}
                    className="min-w-[22px] h-full flex items-center justify-center text-[7px] font-bold text-white px-1"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.score}
                  </div>
                ))}
              </div>
              <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-1 whitespace-nowrap">
                {group.markers.map((m) => (
                  <span
                    key={m.id}
                    className="text-[7px] font-semibold"
                    style={{ color: m.score < 0 ? "#b91c1c" : m.color }}
                  >
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="h-5" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/RaceTrack.tsx
git commit -m "feat: add RaceTrack stacking pills component"
```

---

## Task 3: Standings Component

**Files:**
- Create: `src/components/scoring/Standings.tsx`

- [ ] **Step 1: Build the Standings component**

```tsx
// src/components/scoring/Standings.tsx
import { type PlayerWithScore } from "./types";

interface StandingsProps {
  players: PlayerWithScore[];
  winThreshold: number;
}

export function Standings({ players, winThreshold }: StandingsProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  // Compute ranks with ties (players at the same score share a rank)
  const ranks: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i].score !== sorted[i - 1].score) {
      ranks.push(i + 1);
    } else {
      ranks.push(ranks[i - 1]); // same rank as previous
    }
  }

  return (
    <div className="px-4 space-y-1.5">
      {sorted.map((player, i) => {
        const away = winThreshold - player.score;
        return (
          <div
            key={player.id}
            className="flex items-center justify-between py-2.5 px-3 bg-white border-[1.5px] border-[#e6d7c3] rounded-lg"
            style={{ borderLeftWidth: "4px", borderLeftColor: player.color }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#8b5e3c] w-4">
                {ranks[i]}
              </span>
              <span className="text-[13px] font-semibold text-[#290806]">
                {player.name}
              </span>
            </div>
            <div className="text-right">
              <div
                className={`text-[15px] font-extrabold ${player.score < 0 ? "text-[#b91c1c]" : ""}`}
                style={{ color: player.score >= 0 ? player.color : undefined }}
              >
                {player.score}
              </div>
              <div className="text-[9px] text-[#8b5e3c]">{away} away</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/Standings.tsx
git commit -m "feat: add Standings component with X-away labels"
```

---

## Task 4: RoundHistoryTable Component

**Files:**
- Create: `src/components/scoring/RoundHistoryTable.tsx`

- [ ] **Step 1: Build the RoundHistoryTable with tappable rows**

```tsx
// src/components/scoring/RoundHistoryTable.tsx
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

  // Map player id to their userId/guestId for score lookup
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/RoundHistoryTable.tsx
git commit -m "feat: add RoundHistoryTable with tappable edit rows"
```

---

## Task 5: BetweenRoundsView Composition

**Files:**
- Create: `src/components/scoring/BetweenRoundsView.tsx`

- [ ] **Step 1: Build the composed between-rounds view**

Layout order per brainstorm decision: Track → Graphs (placeholder for Plan 3) → Standings → Score Table.

```tsx
// src/components/scoring/BetweenRoundsView.tsx
"use client";

import { useState } from "react";
import { RaceTrack } from "./RaceTrack";
import { Standings } from "./Standings";
import { RoundHistoryTable } from "./RoundHistoryTable";
import { FloatingCTA } from "./FloatingCTA";
import { type PlayerWithScore } from "./types";

interface BetweenRoundsViewProps {
  players: PlayerWithScore[];
  rounds: {
    scores: {
      userId?: string | null;
      guestId?: string | null;
      blitzPileRemaining: number;
      totalCardsPlayed: number;
    }[];
  }[];
  winThreshold: number;
  nextRoundNumber: number;
  onEnterScores: () => void;
  onEditRound: (roundIndex: number) => void;
}

export function BetweenRoundsView({
  players,
  rounds,
  winThreshold,
  nextRoundNumber,
  onEnterScores,
  onEditRound,
}: BetweenRoundsViewProps) {
  const [editingRound, setEditingRound] = useState<number | null>(null);

  const handleEditRound = (roundIndex: number) => {
    setEditingRound(roundIndex);
    onEditRound(roundIndex);
  };

  return (
    <>
      {/* Race Track */}
      <div className="px-5 pt-4 pb-2">
        <RaceTrack players={players} winThreshold={winThreshold} />
      </div>

      {/* Graph carousel placeholder — will be added in Plan 3 */}
      {/* <GraphCarousel players={players} rounds={rounds} /> */}

      {/* Standings */}
      <div className="pt-2 pb-2">
        <Standings players={players} winThreshold={winThreshold} />
      </div>

      {/* Round history table */}
      <div className="pt-2 pb-2">
        <RoundHistoryTable
          players={players}
          rounds={rounds}
          editingRound={editingRound}
          onEditRound={handleEditRound}
        />
      </div>

      {/* Bottom spacer for floating CTA */}
      <div className="h-20" />

      {/* Floating CTA */}
      <FloatingCTA
        state={{ mode: "nextRound", roundNumber: nextRoundNumber }}
        onAction={onEnterScores}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/BetweenRoundsView.tsx
git commit -m "feat: add BetweenRoundsView layout composition"
```

---

## Task 6: Integrate Into Game Page

**Files:**
- Modify: `src/app/games/[id]/page.tsx`

- [ ] **Step 1: Add between-rounds view to the game page**

The game page needs to manage two states: "entering scores" and "between rounds". When the scoring revamp flag is enabled, add a state toggle between ScoreEntryView and BetweenRoundsView. The between-rounds view shows after a round has been submitted and before the user taps "Enter Next Round."

Import the new components and add the conditional rendering logic. The between-rounds view receives the game's rounds data and players with resolved colors.

```tsx
import { BetweenRoundsView } from "@/components/scoring/BetweenRoundsView";
import { RaceTrack } from "@/components/scoring/RaceTrack";
```

Add the RaceTrack above the score entry cards (sticky with the header), and conditionally show BetweenRoundsView when the user is not actively entering scores.

Note: The full state machine for switching between entry/between-rounds will likely need a client component wrapper since the game page is a server component. Create a thin client wrapper that manages this toggle.

- [ ] **Step 2: Add RaceTrack to the score entry view (sticky)**

In `src/components/scoring/ScoreEntryView.tsx`, add the RaceTrack above the player cards, inside the sticky header area:

```tsx
import { RaceTrack } from "./RaceTrack";

// In the JSX, after the round header and before player cards:
<div className="px-5 pt-4 pb-2">
  <RaceTrack players={players} winThreshold={winThreshold} />
</div>
```

- [ ] **Step 3: Test manually**

Run: `npm run dev`
Navigate to an active game with the `scoring-revamp` flag enabled. Verify:
- Race track shows above the score entry cards
- Pills reflect current scores
- After submitting (via existing flow), the between-rounds view would show standings and history table

- [ ] **Step 4: Commit**

```bash
git add src/app/games/[id]/page.tsx src/components/scoring/ScoreEntryView.tsx
git commit -m "feat: integrate RaceTrack and BetweenRoundsView into game page"
```

---

## Task 7: Update Workbench — Import Shared RaceTrack

**Files:**
- Modify: `src/app/dev/workbench/page.tsx`

- [ ] **Step 1: Replace inline RaceTrack with shared component**

Remove the inline `RaceTrack`, `scoreToPosition`, `groupMarkers`, `TrackMarker`, and `PillGroup` definitions from the workbench. Import from the shared modules instead:

```tsx
import { RaceTrack } from "@/components/scoring/RaceTrack";
import { type PlayerWithScore } from "@/components/scoring/types";
```

Adapt the workbench to pass `PlayerWithScore[]` to the shared RaceTrack.

- [ ] **Step 2: Verify workbench still works**

Run: `npm run dev`
Navigate to `/dev/workbench`. Verify the race track renders and updates as scores change.

- [ ] **Step 3: Commit**

```bash
git add src/app/dev/workbench/page.tsx
git commit -m "refactor: workbench imports shared RaceTrack component"
```

---

## Task 8: PostHog Tracking for Between-Rounds Actions

**Files:**
- Modify: `src/components/scoring/BetweenRoundsView.tsx`

- [ ] **Step 1: Add PostHog event capture for between-rounds interactions**

Import PostHog and fire events for key interactions:

```tsx
import { usePostHog } from "posthog-js/react";

// Inside the component:
const posthog = usePostHog();

// When user taps "Enter Next Round":
const handleEnterScores = () => {
  posthog.capture("scoring_enter_next_round", { round_number: nextRoundNumber });
  onEnterScores();
};

// When user taps a history row to edit:
const handleEditRound = (roundIndex: number) => {
  posthog.capture("scoring_edit_round_tapped", { round_number: roundIndex + 1 });
  setEditingRound(roundIndex);
  onEditRound(roundIndex);
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/BetweenRoundsView.tsx
git commit -m "feat: add PostHog tracking for between-rounds interactions"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Dynamic track bounds ✓. Stacking pills with merge threshold ✓. Negative score handling ✓. Standings with "X away" and shared rank for ties ✓. Tappable history rows with pencil icons ✓. Between-rounds layout (Track → Graphs → Standings → Table) ✓. Graph carousel placeholder for Plan 3 ✓. PostHog tracking ✓.
- [x] **Deferred:** Graph carousel content (Plan 3). Undo toast and inline round editor (Plan 3). Animations on submit (Plan 3). Game over celebration (Plan 4).
- [x] **Placeholder scan:** No TBDs or vague steps. Graph carousel has an explicit placeholder comment.
- [x] **Type consistency:** `TrackMarker` and `PillGroup` defined in `racetrack.ts`, used in `RaceTrack.tsx`. `PlayerWithScore` from shared types used across Standings, RoundHistoryTable, BetweenRoundsView.
