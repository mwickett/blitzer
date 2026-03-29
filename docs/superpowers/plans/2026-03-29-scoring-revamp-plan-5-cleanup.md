# Scoring Revamp Plan 5: Cleanup, Deduplication & Color Prompt

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract duplicated scoring code into shared utilities, fix feature flag gating so old/new UI don't render simultaneously, and wire the ColorPrompt into game creation so players choose deck colors before starting.

**Architecture:** Bottom-up — extractions first (safe refactors), then flag fix (one structural change), then ColorPrompt integration (net-new feature on clean foundations). Legacy code is kept; the feature flag stays.

**Tech Stack:** Next.js App Router, React hooks, TypeScript, Prisma, PostHog, Jest + Testing Library

---

## File Structure

**New files:**
- `src/components/scoring/utils.ts` — `findPlayerScore` pure function
- `src/components/__tests__/scoring/utils.test.ts` — tests for above
- `src/lib/scoring/tiebreak.ts` — `breakTie` pure function
- `src/lib/__tests__/tiebreak.test.ts` — tests for above
- `src/components/scoring/useRoundEditing.ts` — extracted editing hook
- `src/components/scoring/GameColorStep.tsx` — color selection step for game creation
- `src/lib/scoring/colorCascade.ts` — `resolveColorCascade` pure function
- `src/lib/__tests__/colorCascade.test.ts` — tests for above
- `src/components/scoring/useGameColors.ts` — hook wrapping color cascade logic

**Modified files:**
- `src/components/scoring/types.ts` — add `RoundScoreData` and `RoundData` types
- `src/components/scoring/BetweenRoundsView.tsx` — use extracted utils/hook/types
- `src/components/scoring/ScoringShell.tsx` — use extracted utils/hook/types
- `src/components/scoring/GameOverView.tsx` — use shared `RoundData` type
- `src/lib/gameLogic.ts` — use shared `breakTie`
- `src/server/mutations/rounds.ts` — use shared `breakTie`
- `src/app/games/[id]/page.tsx` — fix flag gating conditional
- `src/app/games/new/page.tsx` — include `accentColor` in user query
- `src/app/games/new/newGameChooser.tsx` — add color step before game creation
- `src/server/mutations/games.ts` — accept `accentColor` per player in `createGame`

---

### Task 1: Extract `findPlayerScore` utility

**Files:**
- Create: `src/components/__tests__/scoring/utils.test.ts`
- Create: `src/components/scoring/utils.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/__tests__/scoring/utils.test.ts
import { findPlayerScore } from "../../scoring/utils";

const scores = [
  { userId: "u1", guestId: null, blitzPileRemaining: 3, totalCardsPlayed: 20 },
  { userId: null, guestId: "g1", blitzPileRemaining: 0, totalCardsPlayed: 15 },
];

describe("findPlayerScore", () => {
  it("matches a registered user by userId", () => {
    const player = { id: "u1", name: "Alice", color: "#3b82f6", isGuest: false, userId: "u1", score: 0 };
    const result = findPlayerScore(player, scores);
    expect(result).toBe(scores[0]);
  });

  it("matches a guest user by guestId", () => {
    const player = { id: "g1", name: "Bob", color: "#ef4444", isGuest: true, guestId: "g1", score: 0 };
    const result = findPlayerScore(player, scores);
    expect(result).toBe(scores[1]);
  });

  it("returns undefined when no match", () => {
    const player = { id: "u99", name: "Nobody", color: "#eab308", isGuest: false, userId: "u99", score: 0 };
    const result = findPlayerScore(player, scores);
    expect(result).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern="components/__tests__/scoring/utils" --verbose`
Expected: FAIL — `Cannot find module '../../scoring/utils'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/scoring/utils.ts
import { type PlayerWithScore } from "./types";

type RoundScore = {
  userId?: string | null;
  guestId?: string | null;
  blitzPileRemaining: number;
  totalCardsPlayed: number;
};

export function findPlayerScore(
  player: Pick<PlayerWithScore, "userId" | "guestId">,
  roundScores: RoundScore[]
) {
  return roundScores.find(
    (s) =>
      (player.userId && s.userId === player.userId) ||
      (player.guestId && s.guestId === player.guestId)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern="components/__tests__/scoring/utils" --verbose`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/scoring/utils.ts src/components/__tests__/scoring/utils.test.ts
git commit -m "feat: extract findPlayerScore utility"
```

---

### Task 2: Extract `breakTie` function

**Files:**
- Create: `src/lib/__tests__/tiebreak.test.ts`
- Create: `src/lib/scoring/tiebreak.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/tiebreak.test.ts
import { breakTie } from "../scoring/tiebreak";

describe("breakTie", () => {
  it("returns the player with fewest blitz cards remaining", () => {
    const candidates = [
      { playerId: "a", blitzPileRemaining: 5 },
      { playerId: "b", blitzPileRemaining: 2 },
      { playerId: "c", blitzPileRemaining: 7 },
    ];
    expect(breakTie(candidates)).toBe("b");
  });

  it("returns the first player when all have equal remaining", () => {
    const candidates = [
      { playerId: "a", blitzPileRemaining: 3 },
      { playerId: "b", blitzPileRemaining: 3 },
    ];
    expect(breakTie(candidates)).toBe("a");
  });

  it("returns the single candidate when only one", () => {
    const candidates = [{ playerId: "a", blitzPileRemaining: 10 }];
    expect(breakTie(candidates)).toBe("a");
  });

  it("uses default of 10 when blitzPileRemaining is null", () => {
    const candidates = [
      { playerId: "a", blitzPileRemaining: null },
      { playerId: "b", blitzPileRemaining: 5 },
    ];
    expect(breakTie(candidates as any)).toBe("b");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern="__tests__/tiebreak" --verbose`
Expected: FAIL — `Cannot find module '../scoring/tiebreak'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/scoring/tiebreak.ts

interface TieBreakCandidate {
  playerId: string;
  blitzPileRemaining: number;
}

/**
 * Break a tie among players with equal scores.
 * The player with the fewest blitz cards remaining wins.
 * If still tied, first in the array wins (stable).
 */
export function breakTie(candidates: TieBreakCandidate[]): string {
  let bestId = candidates[0].playerId;
  let bestRemaining = candidates[0].blitzPileRemaining ?? 10;

  for (let i = 1; i < candidates.length; i++) {
    const remaining = candidates[i].blitzPileRemaining ?? 10;
    if (remaining < bestRemaining) {
      bestRemaining = remaining;
      bestId = candidates[i].playerId;
    }
  }

  return bestId;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern="__tests__/tiebreak" --verbose`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/tiebreak.ts src/lib/__tests__/tiebreak.test.ts
git commit -m "feat: extract breakTie utility"
```

---

### Task 3: Add shared `RoundData` type

**Files:**
- Modify: `src/components/scoring/types.ts`

- [ ] **Step 1: Add the shared types to `types.ts`**

Add to the end of `src/components/scoring/types.ts`:

```typescript
export interface RoundScoreData {
  userId?: string | null;
  guestId?: string | null;
  blitzPileRemaining: number;
  totalCardsPlayed: number;
}

export interface RoundData {
  id: string;
  scores: RoundScoreData[];
}
```

- [ ] **Step 2: Run existing tests to verify nothing breaks**

Run: `npm test --verbose`
Expected: All existing tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/scoring/types.ts
git commit -m "feat: add shared RoundData and RoundScoreData types"
```

---

### Task 4: Extract `useRoundEditing` hook

**Files:**
- Create: `src/components/scoring/useRoundEditing.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/components/scoring/useRoundEditing.ts
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { updateRoundScores } from "@/server/mutations/rounds";
import { type PlayerWithScore, type RoundData } from "./types";

interface UseRoundEditingParams {
  gameId: string;
  rounds: RoundData[];
  players: PlayerWithScore[];
}

export function useRoundEditing({ gameId, rounds, players }: UseRoundEditingParams) {
  const router = useRouter();
  const posthog = usePostHog();
  const [editingRoundIndex, setEditingRoundIndex] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const handleEditRound = useCallback((roundIndex: number) => {
    posthog.capture("scoring_edit_round_tapped", { round_number: roundIndex + 1 });
    setEditError(null);
    setEditingRoundIndex(roundIndex);
  }, [posthog]);

  const handleSaveEdit = useCallback(async (
    updated: Record<string, { blitzPileRemaining: number; totalCardsPlayed: number }>
  ) => {
    if (editingRoundIndex === null || editingRoundIndex >= rounds.length) return;
    const round = rounds[editingRoundIndex];
    setEditError(null);

    const scores = players.map((player) => {
      const data = updated[player.id];
      return {
        ...(player.isGuest
          ? { guestId: player.guestId }
          : { userId: player.userId }),
        blitzPileRemaining: data.blitzPileRemaining,
        totalCardsPlayed: data.totalCardsPlayed,
      };
    });

    try {
      await updateRoundScores(gameId, round.id, scores);
      posthog.capture("scoring_round_edited", {
        game_id: gameId,
        round_number: editingRoundIndex + 1,
      });
      setEditingRoundIndex(null);
      router.refresh();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to save changes");
    }
  }, [editingRoundIndex, rounds, players, gameId, posthog, router]);

  const cancelEdit = useCallback(() => {
    setEditingRoundIndex(null);
    setEditError(null);
  }, []);

  return { editingRoundIndex, editError, handleEditRound, handleSaveEdit, cancelEdit };
}
```

- [ ] **Step 2: Run existing tests to verify nothing breaks**

Run: `npm test --verbose`
Expected: All existing tests PASS (new file, no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add src/components/scoring/useRoundEditing.ts
git commit -m "feat: extract useRoundEditing hook"
```

---

### Task 5: Wire extractions into BetweenRoundsView

**Files:**
- Modify: `src/components/scoring/BetweenRoundsView.tsx`

- [ ] **Step 1: Update imports**

Replace the import block and interface at the top of `BetweenRoundsView.tsx`:

```typescript
"use client";

import { useMemo } from "react";
import { usePostHog } from "posthog-js/react";
import { RaceTrack } from "./RaceTrack";
import { Standings } from "./Standings";
import { RoundHistoryTable } from "./RoundHistoryTable";
import { RoundEditor } from "./RoundEditor";
import { FloatingCTA } from "./FloatingCTA";
import { GraphCarousel } from "./GraphCarousel";
import { ScoreProgressionCard } from "./graphs/ScoreProgressionCard";
import { HotColdCard } from "./graphs/HotColdCard";
import { WinProbabilityCard } from "./graphs/WinProbabilityCard";
import { calculateRoundScore } from "@/lib/validation/gameRules";
import { useRoundEditing } from "./useRoundEditing";
import { findPlayerScore } from "./utils";
import { type PlayerWithScore, type RoundData } from "./types";

interface BetweenRoundsViewProps {
  gameId: string;
  players: PlayerWithScore[];
  rounds: RoundData[];
  winThreshold: number;
  nextRoundNumber: number;
  onEnterScores: () => void;
}
```

- [ ] **Step 2: Replace editing state and handlers with hook**

Remove the `useState` imports for `useState, useCallback` (keep `useMemo`). Remove `useRouter` import. Remove the `useState<number | null>(null)` and `useState<string | null>(null)` lines, the `handleEditRound`, `handleSaveEdit` callbacks, and the standalone `findPlayerScore` function (lines 36-45).

Replace with the hook call at the top of the component:

```typescript
export function BetweenRoundsView({
  gameId,
  players,
  rounds,
  winThreshold,
  nextRoundNumber,
  onEnterScores,
}: BetweenRoundsViewProps) {
  const posthog = usePostHog();
  const { editingRoundIndex, editError, handleEditRound, handleSaveEdit, cancelEdit } =
    useRoundEditing({ gameId, rounds, players });
```

- [ ] **Step 3: Update RoundEditor's onCancel**

Change the `onCancel` prop on `RoundEditor` from:
```tsx
onCancel={() => { setEditingRoundIndex(null); setEditError(null); }}
```
to:
```tsx
onCancel={cancelEdit}
```

- [ ] **Step 4: Run existing tests**

Run: `npm test --verbose`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/scoring/BetweenRoundsView.tsx
git commit -m "refactor: wire BetweenRoundsView to shared utils and hook"
```

---

### Task 6: Wire extractions into ScoringShell

**Files:**
- Modify: `src/components/scoring/ScoringShell.tsx`
- Modify: `src/components/scoring/GameOverView.tsx`

- [ ] **Step 1: Update ScoringShell imports**

Replace the import block and interface in `ScoringShell.tsx`:

```typescript
"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { ScoreEntryView } from "./ScoreEntryView";
import { BetweenRoundsView } from "./BetweenRoundsView";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { GameOverView } from "./GameOverView";
import { RoundEditor } from "./RoundEditor";
import { findPlayerScore } from "./utils";
import { useRoundEditing } from "./useRoundEditing";
import { type PlayerWithScore, type RoundData } from "./types";
import { calcGameStats, type RoundResult } from "@/lib/scoring/gameStats";
import { calculateRoundScore } from "@/lib/validation/gameRules";
import { cloneGame } from "@/server/mutations/games";

export type ScoringMode = "entry" | "betweenRounds" | "gameOver";

interface ScoringShellProps {
  gameId: string;
  currentRoundNumber: number;
  players: PlayerWithScore[];
  winThreshold: number;
  isFinished: boolean;
  winnerId?: string;
  endedAt?: string;
  rounds: RoundData[];
}
```

- [ ] **Step 2: Replace editing state with hook**

Remove the `updateRoundScores` import (line 15 of current file). Remove the `editingRoundIndex` useState (line 65-67), the `handleEditRound` callback (lines 117-125), and the `handleSaveEdit` callback (lines 127-157).

Add the hook call after the celebration state:

```typescript
  // Editing state — shared hook for game-over round editing
  const { editingRoundIndex, editError, handleEditRound, handleSaveEdit, cancelEdit } =
    useRoundEditing({ gameId, rounds, players });
```

- [ ] **Step 3: Remove inline `findPlayerScore` from game-over block**

Delete the `findPlayerScore` function definition inside the `if (mode === "gameOver")` block (lines 160-168). It's now imported from `./utils`.

- [ ] **Step 4: Update RoundEditor onCancel in game-over block**

Change:
```tsx
onCancel={() => setEditingRoundIndex(null)}
```
to:
```tsx
onCancel={cancelEdit}
```

- [ ] **Step 5: Add error banner to game-over block**

Add an error banner right before the RoundEditor in the game-over `return` block:

```tsx
{editError && (
  <div className="mx-4 mb-2 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg text-sm text-[#b91c1c]">
    {editError}
  </div>
)}
```

- [ ] **Step 6: Update GameOverView props to use shared type**

In `src/components/scoring/GameOverView.tsx`, update the `rounds` prop type:

Change:
```typescript
import { type PlayerWithScore } from "./types";
```
to:
```typescript
import { type PlayerWithScore, type RoundData } from "./types";
```

And change the `rounds` type in `GameOverViewProps` from:
```typescript
  rounds: {
    scores: {
      userId?: string | null;
      guestId?: string | null;
      blitzPileRemaining: number;
      totalCardsPlayed: number;
    }[];
  }[];
```
to:
```typescript
  rounds: RoundData[];
```

- [ ] **Step 7: Run tests**

Run: `npm test --verbose`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/scoring/ScoringShell.tsx src/components/scoring/GameOverView.tsx
git commit -m "refactor: wire ScoringShell and GameOverView to shared utils, hook, and types"
```

---

### Task 7: Wire `breakTie` into gameLogic.ts and rounds.ts

**Files:**
- Modify: `src/lib/gameLogic.ts:148-176`
- Modify: `src/server/mutations/rounds.ts:304-319`

- [ ] **Step 1: Update gameLogic.ts**

Add import at top of `src/lib/gameLogic.ts`:
```typescript
import { breakTie } from "./scoring/tiebreak";
```

Replace the tie-breaking block inside `determineWinner` (lines 162-176). Change from:

```typescript
    // Tie-breaking: when multiple players have the same highest score,
    // the player with fewer blitz cards remaining in the final round wins.
    if (potentialWinners.length > 1) {
      const finalRound = game.rounds[game.rounds.length - 1];
      potentialWinners.sort((a, b) => {
        const aScore = finalRound.scores.find(
          (s) => s.userId === a.id || s.guestId === a.id
        );
        const bScore = finalRound.scores.find(
          (s) => s.userId === b.id || s.guestId === b.id
        );
        return (
          (aScore?.blitzPileRemaining ?? 10) -
          (bScore?.blitzPileRemaining ?? 10)
        );
      });
    }

    const winnerId = potentialWinners[0].id;
```

to:

```typescript
    let winnerId: string;
    if (potentialWinners.length > 1) {
      const finalRound = game.rounds[game.rounds.length - 1];
      const candidates = potentialWinners.map((pw) => {
        const score = finalRound.scores.find(
          (s) => s.userId === pw.id || s.guestId === pw.id
        );
        return { playerId: pw.id, blitzPileRemaining: score?.blitzPileRemaining ?? 10 };
      });
      winnerId = breakTie(candidates);
    } else {
      winnerId = potentialWinners[0].id;
    }
```

- [ ] **Step 2: Update rounds.ts**

Add import at top of `src/server/mutations/rounds.ts`:
```typescript
import { breakTie } from "@/lib/scoring/tiebreak";
```

Replace the tie-breaking block inside `updateRoundScores` (lines 304-319). Change from:

```typescript
        // Tie-break by fewest blitz cards remaining in final round
        let newWinnerId = topPlayers[0];
        if (topPlayers.length > 1) {
          const finalRound =
            updatedGame.rounds[updatedGame.rounds.length - 1];
          let bestRemaining = Infinity;
          for (const pid of topPlayers) {
            const s = finalRound.scores.find(
              (sc) => (sc.userId ?? sc.guestId ?? "") === pid
            );
            const remaining = s?.blitzPileRemaining ?? 10;
            if (remaining < bestRemaining) {
              bestRemaining = remaining;
              newWinnerId = pid;
            }
          }
        }
```

to:

```typescript
        const finalRound = updatedGame.rounds[updatedGame.rounds.length - 1];
        const candidates = topPlayers.map((pid) => {
          const s = finalRound.scores.find(
            (sc) => (sc.userId ?? sc.guestId ?? "") === pid
          );
          return { playerId: pid, blitzPileRemaining: s?.blitzPileRemaining ?? 10 };
        });
        const newWinnerId = breakTie(candidates);
```

- [ ] **Step 3: Run tests**

Run: `npm test --verbose`
Expected: All tests PASS (gameLogic.test.ts should still pass since behavior is identical)

- [ ] **Step 4: Commit**

```bash
git add src/lib/gameLogic.ts src/server/mutations/rounds.ts
git commit -m "refactor: wire breakTie into gameLogic and rounds mutation"
```

---

### Task 8: Fix feature flag gating in page.tsx

**Files:**
- Modify: `src/app/games/[id]/page.tsx:121-126`

- [ ] **Step 1: Update the ScoreDisplay conditional**

In `src/app/games/[id]/page.tsx`, change the render block from:

```tsx
      <ScoreDisplay
        displayScores={displayScores}
        numRounds={game.rounds.length}
        gameId={game.id}
        isFinished={game.isFinished}
      />
      {useScoringRevamp ? (
```

to:

```tsx
      {!(useScoringRevamp && canViewScoringShell) && (
        <ScoreDisplay
          displayScores={displayScores}
          numRounds={game.rounds.length}
          gameId={game.id}
          isFinished={game.isFinished}
        />
      )}
      {useScoringRevamp ? (
```

This ensures:
- Flag on + circle member: ScoringShell only (ScoreDisplay hidden)
- Flag on + non-member/logged-out: ScoreDisplay (read-only fallback)
- Flag off: ScoreDisplay + ScoreEntry (existing behavior)

- [ ] **Step 2: Run tests**

Run: `npm test --verbose`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/games/[id]/page.tsx
git commit -m "fix: gate ScoreDisplay so it doesn't double-render with ScoringShell"
```

---

### Task 9: Build `resolveColorCascade` utility + test

**Files:**
- Create: `src/lib/__tests__/colorCascade.test.ts`
- Create: `src/lib/scoring/colorCascade.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/colorCascade.test.ts
import { resolveColorCascade } from "../scoring/colorCascade";

describe("resolveColorCascade", () => {
  it("sets the chosen color for the target player", () => {
    const colors = { a: "#3b82f6", b: "#ef4444" };
    const result = resolveColorCascade(colors, "a", "#22c55e");
    expect(result.a).toBe("#22c55e");
    expect(result.b).toBe("#ef4444");
  });

  it("bumps displaced player to next available color", () => {
    const colors = { a: "#3b82f6", b: "#ef4444" };
    const result = resolveColorCascade(colors, "a", "#ef4444");
    expect(result.a).toBe("#ef4444");
    expect(result.b).not.toBe("#ef4444");
    expect(result.b).not.toBe("#3b82f6"); // old color of a is not "available" — it's freed
    // Actually, #3b82f6 IS freed since a no longer holds it
    // b should get the first available from ACCENT_COLORS not used by anyone
  });

  it("never produces duplicate colors", () => {
    const colors = { a: "#3b82f6", b: "#ef4444", c: "#eab308" };
    const result = resolveColorCascade(colors, "a", "#ef4444");
    const values = Object.values(result);
    expect(new Set(values).size).toBe(values.length);
  });

  it("handles no displacement when color is unoccupied", () => {
    const colors = { a: "#3b82f6", b: "#ef4444" };
    const result = resolveColorCascade(colors, "a", "#eab308");
    expect(result).toEqual({ a: "#eab308", b: "#ef4444" });
  });

  it("handles displaced player getting first unused ACCENT_COLOR", () => {
    // All 6 accent colors: blue, red, yellow, green, purple, orange
    const colors = {
      a: "#3b82f6", // blue
      b: "#ef4444", // red
      c: "#eab308", // yellow
    };
    // a takes red from b — b should get the first unused: green (#22c55e)
    const result = resolveColorCascade(colors, "a", "#ef4444");
    expect(result.a).toBe("#ef4444");
    expect(result.b).toBe("#22c55e"); // green — first unused
    expect(result.c).toBe("#eab308"); // unchanged
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern="__tests__/colorCascade" --verbose`
Expected: FAIL — `Cannot find module '../scoring/colorCascade'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/scoring/colorCascade.ts
import { ACCENT_COLORS } from "./colors";

/**
 * Update a player's color and cascade-bump any displaced player.
 * Returns a new color map (does not mutate the input).
 *
 * Invariant: the returned map never contains duplicate values.
 */
export function resolveColorCascade(
  currentColors: Record<string, string>,
  playerId: string,
  newColor: string
): Record<string, string> {
  const next = { ...currentColors };

  // Find who (if anyone) currently holds the new color
  const displacedEntry = Object.entries(next).find(
    ([id, c]) => id !== playerId && c === newColor
  );

  // Assign the new color
  next[playerId] = newColor;

  // Bump the displaced player to the first available accent color
  if (displacedEntry) {
    const usedColors = new Set(Object.values(next));
    const available = ACCENT_COLORS.find((c) => !usedColors.has(c.value));
    if (available) {
      next[displacedEntry[0]] = available.value;
    }
  }

  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern="__tests__/colorCascade" --verbose`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/colorCascade.ts src/lib/__tests__/colorCascade.test.ts
git commit -m "feat: add resolveColorCascade for color step cascade logic"
```

---

### Task 10: Build `useGameColors` hook

**Files:**
- Create: `src/components/scoring/useGameColors.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/components/scoring/useGameColors.ts
"use client";

import { useState, useCallback } from "react";
import { assignColorsToPlayers } from "@/lib/scoring/colors";
import { resolveColorCascade } from "@/lib/scoring/colorCascade";

export interface ColorStepPlayer {
  id: string;
  name: string;
  isGuest: boolean;
  isCurrentUser: boolean;
  defaultColor: string | null;
  avatarUrl?: string | null;
}

export function useGameColors(players: ColorStepPlayer[]) {
  const [colors, setColors] = useState<Record<string, string>>(() => {
    const inputs = players.map((p) => ({
      id: p.id,
      resolvedColor: p.defaultColor,
    }));
    return assignColorsToPlayers(inputs);
  });

  const updateColor = useCallback((playerId: string, newColor: string) => {
    setColors((prev) => resolveColorCascade(prev, playerId, newColor));
  }, []);

  return { colors, updateColor };
}
```

- [ ] **Step 2: Run existing tests**

Run: `npm test --verbose`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/scoring/useGameColors.ts
git commit -m "feat: add useGameColors hook for color step state"
```

---

### Task 11: Build `GameColorStep` component

**Files:**
- Create: `src/components/scoring/GameColorStep.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/scoring/GameColorStep.tsx
"use client";

import { useState } from "react";
import { ColorPicker } from "./ColorPicker";
import { useGameColors, type ColorStepPlayer } from "./useGameColors";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PlayCircle, ArrowLeft } from "lucide-react";

interface GameColorStepProps {
  players: ColorStepPlayer[];
  onConfirm: (colors: Record<string, string>, saveCreatorDefault: boolean) => void;
  onBack: () => void;
}

export function GameColorStep({ players, onConfirm, onBack }: GameColorStepProps) {
  const { colors, updateColor } = useGameColors(players);
  const [saveAsDefault, setSaveAsDefault] = useState(true);

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-[#5a341f] mb-1">
        Pick a color for each player
      </div>

      {players.map((player) => {
        const usedByOthers = Object.entries(colors)
          .filter(([id]) => id !== player.id)
          .map(([, c]) => c);

        return (
          <div
            key={player.id}
            className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-7 w-7">
                {player.avatarUrl ? (
                  <AvatarImage src={player.avatarUrl} alt={player.name} />
                ) : (
                  <AvatarFallback className="bg-[#f0e6d2] text-[#2a0e02] text-xs">
                    {getInitials(player.name)}
                  </AvatarFallback>
                )}
              </Avatar>
              <span className="text-sm font-semibold text-[#290806]">
                {player.name}
              </span>
              {player.isCurrentUser && (
                <span className="text-xs bg-[#f0e6d2] text-[#5a341f] px-2 py-0.5 rounded-full">
                  You
                </span>
              )}
              {player.isGuest && (
                <span className="text-xs bg-[#e6d7c3] text-[#5a341f] px-2 py-0.5 rounded-full">
                  Guest
                </span>
              )}
            </div>

            <ColorPicker
              value={colors[player.id] ?? null}
              onChange={(color) => updateColor(player.id, color)}
              usedColors={usedByOthers}
            />

            {player.isCurrentUser && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAsDefault}
                  onChange={(e) => setSaveAsDefault(e.target.checked)}
                  className="w-4 h-4 rounded border-[#e6d7c3] accent-[#290806]"
                />
                <span className="text-xs text-[#8b5e3c]">
                  Save as my default color
                </span>
              </label>
            )}

            {player.isGuest && (
              <p className="text-xs text-[#b8a08c] italic mt-2">
                Color saved to this game only
              </p>
            )}
          </div>
        );
      })}

      <div className="flex justify-between items-center pt-2 border-t border-[#e6d7c3]">
        <Button variant="ghost" size="sm" className="text-[#5a341f]" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button
          className="bg-[#2a6517] hover:bg-[#1d4a10] text-white font-medium px-6"
          onClick={() => onConfirm(colors, saveAsDefault)}
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          Start Game
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run existing tests**

Run: `npm test --verbose`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/scoring/GameColorStep.tsx
git commit -m "feat: add GameColorStep component for color selection in game creation"
```

---

### Task 12: Update `createGame` mutation to accept player colors

**Files:**
- Modify: `src/server/mutations/games.ts:10-16`

- [ ] **Step 1: Extend the input type**

In `src/server/mutations/games.ts`, change the `createGame` parameter type from:

```typescript
export async function createGame(
  users: {
    id: string;
    username?: string;
    isGuest?: boolean;
  }[],
  winThreshold?: number
) {
```

to:

```typescript
export async function createGame(
  users: {
    id: string;
    username?: string;
    isGuest?: boolean;
    accentColor?: string;
  }[],
  winThreshold?: number
) {
```

- [ ] **Step 2: Use client-provided colors in resolution**

Change the color resolution block (lines 89-98) from:

```typescript
    const colorInputs = users.map((u) => {
      const userDefault = playerDefaults.find((p) => p.id === u.id);
      return {
        id: u.id,
        resolvedColor: resolvePlayerColor({
          gameColor: null,
          userDefault: userDefault?.accentColor ?? null,
        }),
      };
    });
```

to:

```typescript
    const colorInputs = users.map((u) => {
      const userDefault = playerDefaults.find((p) => p.id === u.id);
      return {
        id: u.id,
        resolvedColor: u.accentColor ?? resolvePlayerColor({
          gameColor: null,
          userDefault: userDefault?.accentColor ?? null,
        }),
      };
    });
```

If the client sends a color (from the color step), it takes priority. Otherwise the existing resolution (user default → auto-assign) applies.

- [ ] **Step 3: Run tests**

Run: `npm test --verbose`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/server/mutations/games.ts
git commit -m "feat: accept accentColor per player in createGame mutation"
```

---

### Task 13: Wire GameColorStep into newGameChooser

**Files:**
- Modify: `src/app/games/new/page.tsx:30-40`
- Modify: `src/app/games/new/newGameChooser.tsx`

- [ ] **Step 1: Add `accentColor` to user query**

In `src/app/games/new/page.tsx`, change the prisma select from:

```typescript
    select: {
      id: true,
      username: true,
      clerk_user_id: true,
      avatarUrl: true,
    },
```

to:

```typescript
    select: {
      id: true,
      username: true,
      clerk_user_id: true,
      avatarUrl: true,
      accentColor: true,
    },
```

- [ ] **Step 2: Update `UserSubset` type in newGameChooser**

In `src/app/games/new/newGameChooser.tsx`, change:

```typescript
type UserSubset = Pick<User, "id" | "username" | "clerk_user_id" | "avatarUrl">;
```

to:

```typescript
type UserSubset = Pick<User, "id" | "username" | "clerk_user_id" | "avatarUrl" | "accentColor">;
```

- [ ] **Step 3: Add step state and imports**

Add imports at the top of `newGameChooser.tsx`:

```typescript
import { GameColorStep } from "@/components/scoring/GameColorStep";
import { type ColorStepPlayer } from "@/components/scoring/useGameColors";
import { saveUserAccentColor } from "@/server/mutations/games";
```

Add step state inside the component:

```typescript
  const [step, setStep] = useState<"players" | "colors">("players");
```

- [ ] **Step 4: Create the color step player mapper**

Add a helper inside the component (after `isGuestPlayer`):

```typescript
  const buildColorStepPlayers = (): ColorStepPlayer[] => {
    return inGamePlayers.map((player) => {
      const isGuest = isGuestPlayer(player);
      const isCurrent = isCurrentUser(player);
      const defaultColor = !isGuest && "accentColor" in player
        ? player.accentColor ?? null
        : null;

      return {
        id: player.id,
        name: player.username,
        isGuest,
        isCurrentUser: isCurrent,
        defaultColor,
        avatarUrl: "avatarUrl" in player ? player.avatarUrl : null,
      };
    });
  };
```

- [ ] **Step 5: Update handleCreateGame to accept colors**

Change `handleCreateGame` from:

```typescript
  const handleCreateGame = async () => {
    try {
      const result = await createGame(inGamePlayers, winThreshold);
      if (result && result.gameId) {
        router.push(`/games/${result.gameId}`);
      }
    } catch (error) {
      console.error("Error creating game:", error);
    }
  };
```

to:

```typescript
  const handleCreateGame = async (
    playerColors: Record<string, string>,
    saveCreatorDefault: boolean
  ) => {
    try {
      const playersWithColors = inGamePlayers.map((p) => ({
        ...p,
        accentColor: playerColors[p.id],
      }));
      const result = await createGame(playersWithColors, winThreshold);

      if (saveCreatorDefault) {
        const currentPlayer = inGamePlayers.find((p) => isCurrentUser(p));
        if (currentPlayer && playerColors[currentPlayer.id]) {
          await saveUserAccentColor(playerColors[currentPlayer.id]);
        }
      }

      if (result && result.gameId) {
        router.push(`/games/${result.gameId}`);
      }
    } catch (error) {
      console.error("Error creating game:", error);
    }
  };
```

- [ ] **Step 6: Change "Start Game" button to "Next" and add color step render**

Change the `CardFooter` button from:

```tsx
      <CardFooter className="bg-[#f7f2e9] border-t border-[#e6d7c3] p-4 flex justify-end">
        <Button
          className="bg-[#2a6517] hover:bg-[#1d4a10] text-white font-medium px-6 h-10"
          onClick={handleCreateGame}
          disabled={inGamePlayers.length < 2}
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          Start Game
        </Button>
      </CardFooter>
```

to:

```tsx
      <CardFooter className="bg-[#f7f2e9] border-t border-[#e6d7c3] p-4 flex justify-end">
        <Button
          className="bg-[#2a6517] hover:bg-[#1d4a10] text-white font-medium px-6 h-10"
          onClick={() => setStep("colors")}
          disabled={inGamePlayers.length < 2}
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          Next
        </Button>
      </CardFooter>
```

- [ ] **Step 7: Wrap the component return in step conditional**

Wrap the existing Card return in a step check. Change the return to:

```tsx
  if (step === "colors") {
    return (
      <Card className="mx-auto shadow-md border-[#e6d7c3] max-w-md my-6">
        <CardHeader className="bg-gradient-to-r from-[#5a341f] to-[#8b5e3c] text-white rounded-t-lg">
          <CardTitle className="text-xl flex items-center gap-2">
            <PlayCircle className="h-5 w-5" />
            Choose Colors
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <GameColorStep
            players={buildColorStepPlayers()}
            onConfirm={handleCreateGame}
            onBack={() => setStep("players")}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto shadow-md border-[#e6d7c3] max-w-md my-6">
      {/* ... existing Card content unchanged ... */}
    </Card>
  );
```

The existing `Card` return stays exactly as-is (minus the button text change from Step 6).

- [ ] **Step 8: Run all tests**

Run: `npm test --verbose`
Expected: All tests PASS

- [ ] **Step 9: Manual smoke test**

Run: `npm run dev`

Verify:
1. Navigate to `/games/new`
2. Add 2+ players, click "Next"
3. Color step appears with pre-filled colors
4. Changing a color displaces the other player correctly
5. "Save as my default" checkbox only appears for the current user
6. "Back" returns to player selection
7. "Start Game" creates the game with chosen colors
8. Visit the game page — colors match what was chosen

- [ ] **Step 10: Commit**

```bash
git add src/app/games/new/page.tsx src/app/games/new/newGameChooser.tsx
git commit -m "feat: wire GameColorStep into game creation flow"
```
