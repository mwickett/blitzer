# Scoring Revamp Plan 1: Foundation + Score Entry

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the design system foundation (accent colors, shared primitives) and the new mobile-first score entry experience.

**Architecture:** Add accent color fields to the database (User + GamePlayers), extract reusable scoring components into `src/components/scoring/`, and replace the existing score entry form with vertical player cards, status indicators, and a floating contextual CTA. The existing scoreDisplay.tsx and server mutations remain unchanged — this plan only replaces the entry side.

**Tech Stack:** Next.js 16, React 19, Prisma 7 (PostgreSQL), Tailwind CSS, Zod validation, Jest for unit tests.

**Brainstorm:** `docs/brainstorms/2026-03-28-scoring-experience-brainstorm.md`
**Workbench reference:** `src/app/dev/workbench/page.tsx` (interactive prototype of the target UX)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/scoring/colors.ts` | Accent color constants, precedence resolution, assignment utilities |
| `src/lib/__tests__/colors.test.ts` | Unit tests for color logic |
| `src/components/scoring/StatusIndicator.tsx` | ○/½/✓ entry status dot |
| `src/components/scoring/ScoreEntryCard.tsx` | Single player score entry card with accent color border |
| `src/components/scoring/FloatingCTA.tsx` | Floating contextual action button |
| `src/components/scoring/ColorPicker.tsx` | Accent color selection dots (used in game creation + first-game prompt) |
| `src/components/scoring/ScoreEntryView.tsx` | Composed score entry view (cards + CTA + state management) |
| `src/components/scoring/types.ts` | Shared types for all scoring components |

### Modified Files

| File | Change |
|------|--------|
| `src/server/db/schema.prisma` | Add `accentColor` to User and GamePlayers |
| `src/app/games/[id]/page.tsx` | Integrate new ScoreEntryView (behind feature flag) |
| `src/server/mutations/games.ts` | Assign accent colors on game creation |
| `src/server/queries/games.ts` | Include accentColor in game player queries |
| `src/lib/gameLogic.ts` | Add accentColor to DisplayScores interface |

---

## Task 1: Accent Color Constants and Utilities

**Files:**
- Create: `src/lib/scoring/colors.ts`
- Create: `src/lib/__tests__/colors.test.ts`

- [ ] **Step 1: Write failing tests for color utilities**

```typescript
// src/lib/__tests__/colors.test.ts
import {
  ACCENT_COLORS,
  resolvePlayerColor,
  assignColorsToPlayers,
} from "../scoring/colors";

describe("ACCENT_COLORS", () => {
  it("defines exactly 6 colors", () => {
    expect(ACCENT_COLORS).toHaveLength(6);
  });

  it("each color has a value and label", () => {
    for (const color of ACCENT_COLORS) {
      expect(color.value).toMatch(/^#[0-9a-f]{6}$/);
      expect(color.label).toBeTruthy();
    }
  });
});

describe("resolvePlayerColor", () => {
  it("returns per-game override when present", () => {
    const result = resolvePlayerColor({
      gameColor: "#ef4444",
      userDefault: "#3b82f6",
    });
    expect(result).toBe("#ef4444");
  });

  it("falls back to user default when no game override", () => {
    const result = resolvePlayerColor({
      gameColor: null,
      userDefault: "#3b82f6",
    });
    expect(result).toBe("#3b82f6");
  });

  it("returns null when no color set anywhere", () => {
    const result = resolvePlayerColor({
      gameColor: null,
      userDefault: null,
    });
    expect(result).toBeNull();
  });
});

describe("assignColorsToPlayers", () => {
  it("assigns first available color to players without one", () => {
    const players = [
      { id: "1", resolvedColor: "#3b82f6" },
      { id: "2", resolvedColor: null },
      { id: "3", resolvedColor: null },
    ];
    const result = assignColorsToPlayers(players);
    expect(result["1"]).toBe("#3b82f6");
    expect(result["2"]).toBeTruthy();
    expect(result["3"]).toBeTruthy();
    // No duplicates
    const values = Object.values(result);
    expect(new Set(values).size).toBe(values.length);
  });

  it("respects first-come priority for conflicts", () => {
    const players = [
      { id: "1", resolvedColor: "#3b82f6" },
      { id: "2", resolvedColor: "#3b82f6" }, // conflict
    ];
    const result = assignColorsToPlayers(players);
    expect(result["1"]).toBe("#3b82f6"); // first keeps it
    expect(result["2"]).not.toBe("#3b82f6"); // second gets reassigned
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern='colors.test' --verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement color utilities**

```typescript
// src/lib/scoring/colors.ts

export const ACCENT_COLORS = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#ef4444", label: "Red" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#f97316", label: "Orange" },
] as const;

export type AccentColorValue = (typeof ACCENT_COLORS)[number]["value"];

export function resolvePlayerColor({
  gameColor,
  userDefault,
}: {
  gameColor: string | null;
  userDefault: string | null;
}): string | null {
  return gameColor ?? userDefault ?? null;
}

export function assignColorsToPlayers(
  players: { id: string; resolvedColor: string | null }[]
): Record<string, string> {
  const assigned: Record<string, string> = {};
  const usedColors = new Set<string>();

  // First pass: assign players who already have a color (first-come priority)
  for (const player of players) {
    if (player.resolvedColor && !usedColors.has(player.resolvedColor)) {
      assigned[player.id] = player.resolvedColor;
      usedColors.add(player.resolvedColor);
    }
  }

  // Second pass: assign remaining players the next available color
  const availableColors = ACCENT_COLORS.map((c) => c.value).filter(
    (c) => !usedColors.has(c)
  );
  let colorIndex = 0;

  for (const player of players) {
    if (!assigned[player.id]) {
      assigned[player.id] = availableColors[colorIndex];
      usedColors.add(availableColors[colorIndex]);
      colorIndex++;
    }
  }

  return assigned;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern='colors.test' --verbose`
Expected: PASS — all 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/colors.ts src/lib/__tests__/colors.test.ts
git commit -m "feat: add accent color constants and assignment utilities"
```

---

## Task 2: Database Schema — Add Accent Color Fields

**Files:**
- Modify: `src/server/db/schema.prisma`

- [ ] **Step 1: Add accentColor to User model**

In `src/server/db/schema.prisma`, add to the User model after `avatarUrl`:

```prisma
accentColor String? @map("accent_color")
```

- [ ] **Step 2: Add accentColor to GamePlayers model**

In `src/server/db/schema.prisma`, add to GamePlayers after `guestId`:

```prisma
accentColor String? @map("accent_color")
```

- [ ] **Step 3: Run the migration**

Run: `npx prisma migrate dev --name add-accent-colors`
Expected: Migration created and applied successfully

- [ ] **Step 4: Verify the generated client**

Run: `npx prisma generate`
Expected: Prisma client generated to `src/generated/prisma/`

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.prisma prisma/migrations/
git commit -m "feat: add accentColor fields to User and GamePlayers schema"
```

---

## Task 3: Shared Types for Scoring Components

**Files:**
- Create: `src/components/scoring/types.ts`

- [ ] **Step 1: Define shared scoring types**

```typescript
// src/components/scoring/types.ts

export type EntryStatus = "empty" | "partial" | "complete";

export interface PlayerEntry {
  blitzRemaining: number | null;
  cardsPlayed: number | null;
}

export interface ScoringPlayer {
  id: string;
  name: string;
  color: string;
  isGuest: boolean;
  userId?: string;
  guestId?: string;
}

export interface PlayerWithScore extends ScoringPlayer {
  score: number;
}

export function getEntryStatus(entry: PlayerEntry): EntryStatus {
  const hasBlitz = entry.blitzRemaining !== null && !isNaN(entry.blitzRemaining);
  const hasCards = entry.cardsPlayed !== null && !isNaN(entry.cardsPlayed);
  if (hasBlitz && hasCards) return "complete";
  if (hasBlitz || hasCards) return "partial";
  return "empty";
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/types.ts
git commit -m "feat: add shared types for scoring components"
```

---

## Task 4: StatusIndicator Component

**Files:**
- Create: `src/components/scoring/StatusIndicator.tsx`

- [ ] **Step 1: Build the StatusIndicator component**

```tsx
// src/components/scoring/StatusIndicator.tsx
import { type EntryStatus } from "./types";

const STATUS_CONFIG = {
  empty: { bg: "bg-[#f0e6d2]", text: "text-[#d1bfa8]", icon: "○" },
  partial: { bg: "bg-[#fef3c7]", text: "text-[#b45309]", icon: "½" },
  complete: { bg: "bg-[#dcfce7]", text: "text-[#2a6517]", icon: "✓" },
} as const;

export function StatusIndicator({ status }: { status: EntryStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${config.bg} ${config.text}`}
    >
      {config.icon}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/StatusIndicator.tsx
git commit -m "feat: add StatusIndicator component"
```

---

## Task 5: ScoreEntryCard Component

**Files:**
- Create: `src/components/scoring/ScoreEntryCard.tsx`

- [ ] **Step 1: Build the ScoreEntryCard component**

```tsx
// src/components/scoring/ScoreEntryCard.tsx
"use client";

import { StatusIndicator } from "./StatusIndicator";
import { type EntryStatus, type PlayerEntry } from "./types";

interface ScoreEntryCardProps {
  name: string;
  color: string;
  score: number;
  entry: PlayerEntry;
  status: EntryStatus;
  onUpdate: (field: "blitzRemaining" | "cardsPlayed", value: number | null) => void;
}

function handleNumericInput(
  value: string,
  max: number,
  onChange: (v: number | null) => void
) {
  const raw = value.replace(/[^0-9]/g, "");
  if (raw === "") {
    onChange(null);
    return;
  }
  const n = parseInt(raw, 10);
  if (!isNaN(n)) onChange(Math.min(max, Math.max(0, n)));
}

export function ScoreEntryCard({
  name,
  color,
  score,
  entry,
  status,
  onUpdate,
}: ScoreEntryCardProps) {
  return (
    <div
      className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-3 flex items-center gap-2.5"
      style={{ borderLeftWidth: "5px", borderLeftColor: color }}
    >
      <div className="w-16 flex-shrink-0">
        <div className="text-sm font-semibold text-[#290806]">{name}</div>
        <div
          className={`text-[11px] ${score < 0 ? "text-[#b91c1c]" : "text-[#8b5e3c]"}`}
        >
          {score} pts
        </div>
      </div>

      <div className="flex gap-2 flex-1">
        <div className="flex-1">
          <label className="block text-[9px] text-[#8b5e3c] uppercase tracking-wider font-medium mb-1">
            Blitz left
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={entry.blitzRemaining !== null ? String(entry.blitzRemaining) : ""}
            onChange={(e) =>
              handleNumericInput(e.target.value, 10, (v) =>
                onUpdate("blitzRemaining", v)
              )
            }
            className="w-full h-11 bg-[#fff7ea] border-[1.5px] border-[#e6d7c3] rounded-lg text-[#290806] text-xl font-semibold text-center focus:border-[#8b5e3c] focus:outline-none transition-colors"
            placeholder="—"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[9px] text-[#8b5e3c] uppercase tracking-wider font-medium mb-1">
            Cards played
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={entry.cardsPlayed !== null ? String(entry.cardsPlayed) : ""}
            onChange={(e) =>
              handleNumericInput(e.target.value, 40, (v) =>
                onUpdate("cardsPlayed", v)
              )
            }
            className="w-full h-11 bg-[#fff7ea] border-[1.5px] border-[#e6d7c3] rounded-lg text-[#290806] text-xl font-semibold text-center focus:border-[#8b5e3c] focus:outline-none transition-colors"
            placeholder="—"
          />
        </div>
      </div>

      <StatusIndicator status={status} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/ScoreEntryCard.tsx
git commit -m "feat: add ScoreEntryCard component with accent color border"
```

---

## Task 6: FloatingCTA Component

**Files:**
- Create: `src/components/scoring/FloatingCTA.tsx`

- [ ] **Step 1: Build the FloatingCTA component**

```tsx
// src/components/scoring/FloatingCTA.tsx
"use client";

export type CTAState =
  | { mode: "submit"; remainingCount: number; allComplete: boolean }
  | { mode: "nextRound"; roundNumber: number }
  | { mode: "editing" }
  | { mode: "gameOver" };

export function FloatingCTA({
  state,
  onAction,
  onCancel,
}: {
  state: CTAState;
  onAction: () => void;
  onCancel?: () => void;
}) {
  if (state.mode === "gameOver") return null;

  if (state.mode === "editing") {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-[#fff7ea] via-[#fff7ea] to-transparent pt-8">
        <div className="max-w-[440px] mx-auto flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-xl text-[15px] font-bold bg-[#f0e6d2] text-[#8b5e3c] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onAction}
            className="flex-1 py-3.5 rounded-xl text-[15px] font-bold bg-[#2a6517] text-white cursor-pointer hover:bg-[#1d4a10] transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  const isSubmit = state.mode === "submit";
  const disabled = isSubmit && !state.allComplete;
  const label = isSubmit
    ? state.allComplete
      ? "Submit Round"
      : `Submit Round (${state.remainingCount} remaining)`
    : `Enter Round ${state.roundNumber} Scores`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-[#fff7ea] via-[#fff7ea] to-transparent pt-8">
      <div className="max-w-[440px] mx-auto">
        <button
          onClick={onAction}
          disabled={disabled}
          className={`w-full py-3.5 rounded-xl text-[15px] font-bold transition-all ${
            disabled
              ? "bg-[#f0e6d2] text-[#d1bfa8] cursor-not-allowed"
              : isSubmit
                ? "bg-[#2a6517] text-white hover:bg-[#1d4a10] cursor-pointer"
                : "bg-[#290806] text-white hover:bg-[#3d1a0a] cursor-pointer"
          }`}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/FloatingCTA.tsx
git commit -m "feat: add FloatingCTA component with contextual states"
```

---

## Task 7: ColorPicker Component

**Files:**
- Create: `src/components/scoring/ColorPicker.tsx`

- [ ] **Step 1: Build the ColorPicker component**

```tsx
// src/components/scoring/ColorPicker.tsx
"use client";

import { ACCENT_COLORS } from "@/lib/scoring/colors";

export function ColorPicker({
  value,
  onChange,
  usedColors = [],
}: {
  value: string | null;
  onChange: (color: string) => void;
  usedColors?: string[];
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {ACCENT_COLORS.map((c) => {
        const isUsed = usedColors.includes(c.value) && c.value !== value;
        const isSelected = value === c.value;
        return (
          <button
            key={c.value}
            onClick={() => !isUsed && onChange(c.value)}
            className={`w-9 h-9 rounded-full border-2 transition-all ${
              isSelected
                ? "border-[#290806] scale-110 shadow-sm"
                : isUsed
                  ? "border-transparent opacity-25 cursor-not-allowed"
                  : "border-transparent hover:border-[#d1bfa8] cursor-pointer"
            }`}
            style={{ backgroundColor: c.value }}
            title={isUsed ? `${c.label} (taken)` : c.label}
            disabled={isUsed}
            aria-label={`${c.label}${isSelected ? " (selected)" : ""}${isUsed ? " (taken)" : ""}`}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/ColorPicker.tsx
git commit -m "feat: add ColorPicker component with duplicate prevention"
```

---

## Task 8: ScoreEntryView — Composed Entry Experience

**Files:**
- Create: `src/components/scoring/ScoreEntryView.tsx`

- [ ] **Step 1: Build the composed ScoreEntryView**

This is the main component that replaces the existing `scoreEntry.tsx`. It manages entry state, renders player cards, and integrates the floating CTA.

```tsx
// src/components/scoring/ScoreEntryView.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ScoreEntryCard } from "./ScoreEntryCard";
import { FloatingCTA } from "./FloatingCTA";
import { type PlayerEntry, type ScoringPlayer, getEntryStatus } from "./types";
import { validateGameRules } from "@/lib/validation/gameRules";
import { createRoundForGame } from "@/server/mutations";

interface ScoreEntryViewProps {
  gameId: string;
  currentRoundNumber: number;
  players: (ScoringPlayer & { score: number })[];
  winThreshold: number;
}

export function ScoreEntryView({
  gameId,
  currentRoundNumber,
  players,
  winThreshold,
}: ScoreEntryViewProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<Record<string, PlayerEntry>>(() =>
    Object.fromEntries(
      players.map((p) => [p.id, { blitzRemaining: null, cardsPlayed: null }])
    )
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allComplete = useMemo(
    () => Object.values(entries).every((e) => getEntryStatus(e) === "complete"),
    [entries]
  );

  const remainingCount = useMemo(
    () =>
      Object.values(entries).filter((e) => getEntryStatus(e) !== "complete")
        .length,
    [entries]
  );

  const handleUpdate = useCallback(
    (playerId: string, field: "blitzRemaining" | "cardsPlayed", value: number | null) => {
      setEntries((prev) => ({
        ...prev,
        [playerId]: { ...prev[playerId], [field]: value },
      }));
      setError(null);
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!allComplete || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    const scores = players.map((player) => {
      const entry = entries[player.id];
      return {
        oderId: player.id,
        oderId: undefined as string | undefined,
        guestId: undefined as string | undefined,
        ...(player.isGuest
          ? { guestId: player.guestId }
          : { userId: player.userId }),
        blitzPileRemaining: entry.blitzRemaining ?? 0,
        totalCardsPlayed: entry.cardsPlayed ?? 0,
      };
    });

    try {
      validateGameRules(scores);
      await createRoundForGame(gameId, currentRoundNumber, scores);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit round");
      setIsSubmitting(false);
    }
  }, [allComplete, isSubmitting, players, entries, gameId, currentRoundNumber, router]);

  return (
    <>
      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg text-sm text-[#b91c1c]">
          {error}
        </div>
      )}

      {/* Player cards */}
      <div className="px-4 pt-2 pb-2 space-y-2.5">
        {players.map((player) => (
          <ScoreEntryCard
            key={player.id}
            name={player.name}
            color={player.color}
            score={player.score}
            entry={entries[player.id]}
            status={getEntryStatus(entries[player.id])}
            onUpdate={(field, value) => handleUpdate(player.id, field, value)}
          />
        ))}
      </div>

      {/* Bottom spacer for floating CTA */}
      <div className="h-20" />

      {/* Floating CTA */}
      <FloatingCTA
        state={{
          mode: "submit",
          remainingCount,
          allComplete: allComplete && !isSubmitting,
        }}
        onAction={handleSubmit}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/ScoreEntryView.tsx
git commit -m "feat: add ScoreEntryView composed entry experience"
```

---

## Task 9: Update Data Layer — Include Colors in Queries

**Files:**
- Modify: `src/lib/gameLogic.ts:5-14` (GameWithPlayersAndScores interface)
- Modify: `src/server/queries/games.ts` (include accentColor in queries)

- [ ] **Step 1: Add accentColor to the GameWithPlayersAndScores interface**

In `src/lib/gameLogic.ts`, update the `players` type in the interface to include `accentColor`:

```typescript
// src/lib/gameLogic.ts — update the players type in GameWithPlayersAndScores
export interface GameWithPlayersAndScores extends Game {
  players: {
    id: string;
    gameId: string;
    userId?: string;
    guestId?: string;
    accentColor?: string | null;
    user?: User;
    guestUser?: GuestUser;
  }[];
  rounds: (Round & { scores: Score[] })[];
}
```

- [ ] **Step 2: Add accentColor to the DisplayScores interface**

In `src/lib/gameLogic.ts`, add to the DisplayScores interface:

```typescript
export interface DisplayScores {
  id: string;
  userId?: string;
  username: string;
  isGuest: boolean;
  scoresByRound: number[];
  total: number;
  isInLead?: boolean;
  isWinner?: boolean;
  accentColor?: string | null;
}
```

- [ ] **Step 3: Pass accentColor through in transformGameData**

In the `transformGameData` function where it initializes `playerMap`, add accentColor to the mapped data. Find the section that creates entries in the playerMap and add:

```typescript
accentColor: player.accentColor ?? null,
```

And pass it through to the final return array.

- [ ] **Step 4: Include accentColor in game queries**

In `src/server/queries/games.ts`, the `getGameById` function uses `include` for players. Add `accentColor: true` to the player select if using explicit selects, or verify it's included by default (Prisma includes all scalar fields by default with `include`, so it should already be available after the migration). Verify by checking the query.

- [ ] **Step 5: Run existing tests to verify nothing broke**

Run: `npm test -- --verbose`
Expected: All existing tests pass (the new field is optional/nullable so it shouldn't break anything)

- [ ] **Step 6: Commit**

```bash
git add src/lib/gameLogic.ts src/server/queries/games.ts
git commit -m "feat: include accentColor in game data pipeline"
```

---

## Task 10: Client Scoring Shell + Game Page Integration

**Files:**
- Create: `src/components/scoring/ScoringShell.tsx`
- Modify: `src/app/games/[id]/page.tsx`

The game page (`page.tsx`) is a **server component** — it cannot hold client state, callbacks, or UI toggles. All stateful scoring UI (entry ↔ between-rounds ↔ editing ↔ celebration) must live in a single client component that the server page instantiates with serialized props.

- [ ] **Step 1: Create the ScoringShell client wrapper**

This is the single client component that owns the scoring state machine. It receives all data from the server page as serialized props (no callbacks, no functions).

```tsx
// src/components/scoring/ScoringShell.tsx
"use client";

import { useState } from "react";
import { ScoreEntryView } from "./ScoreEntryView";
import { type PlayerWithScore } from "./types";

type ScoringMode = "entry" | "betweenRounds" | "editing" | "gameOver";

interface ScoringShellProps {
  gameId: string;
  currentRoundNumber: number;
  players: PlayerWithScore[];
  winThreshold: number;
  isFinished: boolean;
  winnerName?: string;
  rounds: {
    scores: {
      userId?: string | null;
      guestId?: string | null;
      blitzPileRemaining: number;
      totalCardsPlayed: number;
    }[];
  }[];
}

export function ScoringShell({
  gameId,
  currentRoundNumber,
  players,
  winThreshold,
  isFinished,
  rounds,
}: ScoringShellProps) {
  // For Plan 1, only score entry mode is needed.
  // Between-rounds, editing, and game over modes are added in Plans 2-4.
  // This shell will grow to manage all mode transitions.

  return (
    <ScoreEntryView
      gameId={gameId}
      currentRoundNumber={currentRoundNumber}
      players={players}
      winThreshold={winThreshold}
    />
  );
}
```

- [ ] **Step 2: Commit the shell**

```bash
git add src/components/scoring/ScoringShell.tsx
git commit -m "feat: add ScoringShell client wrapper for server/client boundary"
```

- [ ] **Step 3: Integrate into the server game page behind a feature flag**

The existing `scoreEntry.tsx` stays in place. The new `ScoringShell` replaces it when the `scoring-revamp` feature flag is enabled.

In `src/app/games/[id]/page.tsx`, add the import and conditional rendering:

```tsx
import { ScoreEntryView } from "@/components/scoring/ScoreEntryView";
import { isFeatureEnabled } from "@/featureFlags";
import { resolvePlayerColor } from "@/lib/scoring/colors";
import { assignColorsToPlayers } from "@/lib/scoring/colors";
```

Then in the component body, after `transformGameData`, resolve colors and conditionally render:

```tsx
const useScoringRevamp = await isFeatureEnabled("scoring-revamp");

// Resolve accent colors for all players
const playerColorInputs = game.players.map((p) => ({
  id: p.id,
  resolvedColor: resolvePlayerColor({
    gameColor: p.accentColor ?? null,
    userDefault: p.user?.accentColor ?? null,
  }),
}));
const colorAssignments = assignColorsToPlayers(playerColorInputs);

// Build ScoringPlayer array for the new entry view.
// DisplayScores.id is the participant's userId or guestId (from gameLogic.ts line 193).
// Use this stable ID to join back to GamePlayers — NOT display names (fragile for guest collisions).
const scoringPlayers = displayScores.map((ds) => {
  const gamePlayer = game.players.find(
    (p) => p.userId === ds.id || p.guestId === ds.id
  );
  return {
    id: ds.id,
    name: ds.username,
    color: colorAssignments[gamePlayer?.id ?? ds.id] ?? "#3b82f6",
    isGuest: ds.isGuest,
    userId: gamePlayer?.userId ?? undefined,
    guestId: gamePlayer?.guestId ?? undefined,
    score: ds.total,
  };
});
```

Then in the JSX, replace the ScoreEntry rendering with a conditional:

```tsx
{userId && orgId === game.organizationId && !game.isFinished && (
  useScoringRevamp ? (
    <ScoreEntryView
      gameId={game.id}
      currentRoundNumber={currentRoundNumber}
      players={scoringPlayers}
      winThreshold={game.winThreshold}
    />
  ) : (
    <ScoreEntry
      game={game}
      currentRoundNumber={currentRoundNumber}
      displayScores={displayScores}
    />
  )
)}
```

- [ ] **Step 2: Create the feature flag in PostHog**

Create a `scoring-revamp` feature flag in PostHog (or your feature flag provider) and enable it for your development user.

- [ ] **Step 3: Test manually**

Run: `npm run dev`
Navigate to an active game. With the feature flag enabled, you should see:
- Vertical player cards with accent color left borders
- Status indicators (○ for empty fields)
- Floating "Submit Round (N remaining)" button at the bottom
- Cards transition to ✓ as you fill in both fields
- Submit button turns green when all cards are complete

- [ ] **Step 4: Commit**

```bash
git add src/app/games/[id]/page.tsx
git commit -m "feat: integrate new ScoreEntryView behind scoring-revamp flag"
```

---

## Task 11: Color Assignment on Game Creation

**Files:**
- Modify: `src/server/mutations/games.ts`

- [ ] **Step 1: Assign colors when creating a game**

In the `createGame` function, after creating the game and before/during creating GamePlayers entries, assign accent colors. Import the color utilities and resolve colors for each player:

```typescript
import { resolvePlayerColor, assignColorsToPlayers } from "@/lib/scoring/colors";
```

After looking up player data, before creating GamePlayers:

```typescript
// Resolve accent colors for all players
const playerColors = assignColorsToPlayers(
  users.map((u) => {
    const dbPlayer = players?.find((p) => p.id === u.id);
    return {
      id: u.id,
      resolvedColor: resolvePlayerColor({
        gameColor: null, // No per-game override at creation time
        userDefault: dbPlayer?.accentColor ?? null,
      }),
    };
  })
);
```

Then when creating each GamePlayers entry, include the assigned color:

```typescript
accentColor: playerColors[user.id] ?? null,
```

- [ ] **Step 2: Run existing game creation tests**

Run: `npm test -- --testPathPattern='mutations' --verbose`
Expected: Existing tests still pass (accentColor is optional)

- [ ] **Step 3: Commit**

```bash
git add src/server/mutations/games.ts
git commit -m "feat: assign accent colors on game creation"
```

---

## Task 12: Update Workbench to Match Final Components

**Files:**
- Modify: `src/app/dev/workbench/page.tsx`

- [ ] **Step 1: Refactor workbench to import shared components**

Update the workbench to import from the new shared components instead of defining its own copies. This validates that the extracted components work correctly and keeps the workbench as a living integration test.

Replace the inline `ScoreEntryCard`, `StatusIndicator`, and `ColorPicker` in the workbench with imports:

```tsx
import { ScoreEntryCard } from "@/components/scoring/ScoreEntryCard";
import { StatusIndicator } from "@/components/scoring/StatusIndicator";
import { ColorPicker } from "@/components/scoring/ColorPicker";
import { FloatingCTA } from "@/components/scoring/FloatingCTA";
import { getEntryStatus } from "@/components/scoring/types";
import { ACCENT_COLORS } from "@/lib/scoring/colors";
```

Remove the duplicate component definitions from the workbench file. Keep the workbench-specific features (RaceTrack, undo toast, round editor, player management controls) as they are — those will be extracted in later plans.

- [ ] **Step 2: Verify the workbench still works**

Run: `npm run dev`
Navigate to `/dev/workbench` and verify everything works as before.

- [ ] **Step 3: Commit**

```bash
git add src/app/dev/workbench/page.tsx
git commit -m "refactor: workbench imports shared scoring components"
```

---

## Task 13: Design Tokens — Extract Brand Palette

**Files:**
- Create: `src/lib/scoring/tokens.ts`
- Modify: `src/app/globals.css`

The warm brand palette (`#290806`, `#8b5e3c`, `#fff7ea`, `#f0e6d2`, `#e6d7c3`, etc.) is used across every scoring component. Extract these as CSS custom properties so the palette can be updated in one place.

- [ ] **Step 1: Add scoring CSS custom properties to globals.css**

In `src/app/globals.css`, add inside `:root`:

```css
/* Scoring design tokens */
--scoring-bg: #fff7ea;
--scoring-bg-muted: #f0e6d2;
--scoring-bg-subtle: #faf5ed;
--scoring-border: #e6d7c3;
--scoring-border-muted: #d1bfa8;
--scoring-text: #290806;
--scoring-text-muted: #8b5e3c;
--scoring-text-negative: #b91c1c;
--scoring-success: #2a6517;
--scoring-success-hover: #1d4a10;
```

- [ ] **Step 2: Create a TypeScript token reference file**

```typescript
// src/lib/scoring/tokens.ts
// Reference for scoring design tokens — CSS custom properties are the source of truth.
// Use these Tailwind classes in components:
//
// Backgrounds:   bg-[var(--scoring-bg)]  bg-[var(--scoring-bg-muted)]  bg-[var(--scoring-bg-subtle)]
// Borders:       border-[var(--scoring-border)]  border-[var(--scoring-border-muted)]
// Text:          text-[var(--scoring-text)]  text-[var(--scoring-text-muted)]  text-[var(--scoring-text-negative)]
// Success:       bg-[var(--scoring-success)]
//
// Accent colors (player-specific) remain as inline styles since they're dynamic per-player.

export const SCORING_TOKENS = {
  bg: "var(--scoring-bg)",
  bgMuted: "var(--scoring-bg-muted)",
  bgSubtle: "var(--scoring-bg-subtle)",
  border: "var(--scoring-border)",
  borderMuted: "var(--scoring-border-muted)",
  text: "var(--scoring-text)",
  textMuted: "var(--scoring-text-muted)",
  textNegative: "var(--scoring-text-negative)",
  success: "var(--scoring-success)",
} as const;
```

Note: Migrating existing components to use CSS custom properties can be done incrementally. New components should use them from the start. Existing hardcoded hex values in Plans 1-4 components can be swapped during implementation or in a follow-up polish pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring/tokens.ts src/app/globals.css
git commit -m "feat: extract scoring design tokens as CSS custom properties"
```

---

## Task 14: Sticky Round Header

**Files:**
- Create: `src/components/scoring/RoundHeader.tsx`

- [ ] **Step 1: Build the sticky round header component**

```tsx
// src/components/scoring/RoundHeader.tsx

interface RoundHeaderProps {
  title: string;
  subtitle: string;
}

export function RoundHeader({ title, subtitle }: RoundHeaderProps) {
  return (
    <div className="px-5 pt-4 pb-2 bg-[#fff7ea] sticky top-0 z-20 border-b border-[#f0e6d2]">
      <h2 className="text-lg font-bold text-[#290806]">{title}</h2>
      <div className="text-xs text-[#8b5e3c]">{subtitle}</div>
    </div>
  );
}
```

- [ ] **Step 2: Integrate into ScoreEntryView**

In `src/components/scoring/ScoreEntryView.tsx`, add the RoundHeader above the player cards:

```tsx
import { RoundHeader } from "./RoundHeader";

// In the JSX, before the player cards:
<RoundHeader
  title={`Round ${currentRoundNumber}`}
  subtitle={`First to ${winThreshold} wins`}
/>
```

The RaceTrack (added in Plan 2) will go between the header and the cards, also inside the sticky area.

- [ ] **Step 3: Commit**

```bash
git add src/components/scoring/RoundHeader.tsx src/components/scoring/ScoreEntryView.tsx
git commit -m "feat: add sticky RoundHeader component"
```

---

## Task 15: First-Game Color Prompt

**Files:**
- Create: `src/components/scoring/ColorPrompt.tsx`
- Modify: `src/server/mutations/games.ts`

This implements the onboarding flow: when a player has no accent color default, they're prompted to pick one during game creation.

- [ ] **Step 1: Build the ColorPrompt dialog**

```tsx
// src/components/scoring/ColorPrompt.tsx
"use client";

import { useState } from "react";
import { ColorPicker } from "./ColorPicker";
import { ACCENT_COLORS } from "@/lib/scoring/colors";

interface ColorPromptProps {
  playerName: string;
  usedColors: string[];
  onSelect: (color: string, saveAsDefault: boolean) => void;
}

export function ColorPrompt({
  playerName,
  usedColors,
  onSelect,
}: ColorPromptProps) {
  const firstAvailable = ACCENT_COLORS.find(
    (c) => !usedColors.includes(c.value)
  );
  const [selected, setSelected] = useState<string | null>(
    firstAvailable?.value ?? null
  );
  const [saveAsDefault, setSaveAsDefault] = useState(true);

  return (
    <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
      <div className="text-sm font-bold text-[#290806] mb-1">
        Choose your color, {playerName}
      </div>
      <div className="text-xs text-[#8b5e3c] mb-3">
        Pick the color that matches your Dutch Blitz deck
      </div>

      <ColorPicker
        value={selected}
        onChange={setSelected}
        usedColors={usedColors}
      />

      <label className="flex items-center gap-2 mt-3 cursor-pointer">
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

      <button
        onClick={() => selected && onSelect(selected, saveAsDefault)}
        disabled={!selected}
        className={`w-full mt-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${
          selected
            ? "bg-[#290806] text-white cursor-pointer"
            : "bg-[#f0e6d2] text-[#d1bfa8] cursor-not-allowed"
        }`}
      >
        Confirm
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add saveAccentColor server action**

In `src/server/mutations/games.ts`, add a function to save the user's default accent color:

```typescript
export async function saveUserAccentColor(color: string) {
  const { user, posthog } = await getAuthenticatedUserWithOrg();
  const currentUser = await prisma.user.findUnique({
    where: { clerk_user_id: user.userId },
  });
  if (!currentUser) throw new Error("User not found");

  await prisma.user.update({
    where: { id: currentUser.id },
    data: { accentColor: color },
  });

  posthog.capture({
    distinctId: user.userId,
    event: "set_accent_color",
    properties: { color },
  });
}
```

- [ ] **Step 3: Wire prompt into game creation flow**

In the game creation page (`src/app/games/new/page.tsx`), after players are selected and before the game starts, check if any player has no accentColor. If so, show the `ColorPrompt` for that player. Once all players have colors, proceed with game creation.

The prompt should be shown one at a time for each player who needs one (though in practice, only the current user is prompted — other users set their own color when they first play).

- [ ] **Step 4: Commit**

```bash
git add src/components/scoring/ColorPrompt.tsx src/server/mutations/games.ts
git commit -m "feat: add first-game color prompt with save-as-default option"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Accent colors (constants, precedence, assignment, schema, first-come priority) ✓. Score entry cards (vertical stack, non-linear, status indicators) ✓. Floating CTA (contextual states for submit) ✓. Color picker (dot selection, duplicate prevention) ✓. Feature flag rollout ✓. Design tokens ✓. Sticky round header ✓. First-game color prompt with save-as-default ✓. Guest color assignment via auto-assign at creation ✓.
- [x] **Deferred to Plan 2:** Race track, between-rounds layout.
- [x] **Deferred to Plan 3:** Graph carousel, undo toast, inline round editing, optimistic UI, integration tests.
- [x] **Deferred to Plan 4:** Game over celebration, results view.
- [x] **Placeholder scan:** No TBDs, TODOs, or "similar to Task N" found.
- [x] **Type consistency:** `PlayerEntry`, `ScoringPlayer`, `EntryStatus`, `getEntryStatus` used consistently across all tasks. `AccentColorValue` defined in colors.ts. `ScoreEntryCardProps` matches the interface used in `ScoreEntryView`.
- [x] **Known issue:** The `handleSubmit` in Task 8 has a copy-paste bug with `oderId` — fix during implementation. The scores array construction should use the existing `RoundScoreData` type from `scoreTypes.ts`.
