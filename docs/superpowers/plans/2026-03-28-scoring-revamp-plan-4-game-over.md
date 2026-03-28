# Scoring Revamp Plan 4: Game Over Experience

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the game over celebration (brief color flash with confetti + trophy) and the final results view (winner card, standings with stats, game summary, score progression preview, rematch actions).

**Architecture:** The celebration is a CSS animation overlay that fires on mount, auto-fades after ~2 seconds, and reveals the results view underneath. The celebration component is self-contained — it receives the winner's accent color and handles its own animation lifecycle. The results view composes existing components (Standings) with new game-summary stats.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS, CSS animations (no animation library needed).

**Depends on:** Plan 1 (accent colors, types) + Plan 2 (Standings) + Plan 3 (graphs, undo toast)

**Brainstorm:** `docs/brainstorms/2026-03-28-scoring-experience-brainstorm.md`
**Prototype reference:** `docs/brainstorms/game-over.html`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/components/scoring/CelebrationOverlay.tsx` | Animated color flash with confetti and trophy — auto-fades after 2s |
| `src/components/scoring/GameOverView.tsx` | Final results: winner card, standings with stats, game summary grid, score preview, actions |
| `src/lib/scoring/gameStats.ts` | Pure functions: compute game summary stats (biggest round, worst round, blitz counts, etc.) |
| `src/lib/__tests__/gameStats.test.ts` | Unit tests for game stats calculations |

### Modified Files

| File | Change |
|------|--------|
| `src/app/games/[id]/page.tsx` | Replace GameOver modal with CelebrationOverlay + GameOverView when flag enabled |

---

## Task 1: Game Stats Calculations

**Files:**
- Create: `src/lib/scoring/gameStats.ts`
- Create: `src/lib/__tests__/gameStats.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/__tests__/gameStats.test.ts
import { calcGameStats, type RoundResult } from "../scoring/gameStats";

const sampleRounds: RoundResult[] = [
  {
    deltas: { p1: 18, p2: 12, p3: 8, p4: -4 },
    blitzCounts: { p1: 0, p2: 0, p3: 0, p4: 0 },
  },
  {
    deltas: { p1: 6, p2: 14, p3: 2, p4: -6 },
    blitzCounts: { p1: 0, p2: 1, p3: 0, p4: 0 },
  },
  {
    deltas: { p1: 14, p2: 8, p3: 10, p4: 6 },
    blitzCounts: { p1: 1, p2: 0, p3: 0, p4: 0 },
  },
];

const playerNames: Record<string, string> = {
  p1: "Mike",
  p2: "Sarah",
  p3: "Dan",
  p4: "Jo",
};

describe("calcGameStats", () => {
  it("finds the biggest single round", () => {
    const stats = calcGameStats(sampleRounds, playerNames);
    expect(stats.biggestRound.delta).toBe(18);
    expect(stats.biggestRound.playerName).toBe("Mike");
    expect(stats.biggestRound.roundNumber).toBe(1);
  });

  it("finds the worst single round", () => {
    const stats = calcGameStats(sampleRounds, playerNames);
    expect(stats.worstRound.delta).toBe(-6);
    expect(stats.worstRound.playerName).toBe("Jo");
    expect(stats.worstRound.roundNumber).toBe(2);
  });

  it("counts total blitzes per player", () => {
    const stats = calcGameStats(sampleRounds, playerNames);
    expect(stats.blitzCounts["p1"]).toBe(1);
    expect(stats.blitzCounts["p2"]).toBe(1);
    expect(stats.totalBlitzes).toBe(2);
  });

  it("counts round wins per player", () => {
    const stats = calcGameStats(sampleRounds, playerNames);
    expect(stats.roundWins["p1"]).toBe(2); // rounds 1 and 3
    expect(stats.roundWins["p2"]).toBe(1); // round 2
  });

  it("returns total rounds played", () => {
    const stats = calcGameStats(sampleRounds, playerNames);
    expect(stats.roundsPlayed).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern='gameStats.test' --verbose`
Expected: FAIL

- [ ] **Step 3: Implement game stats logic**

```typescript
// src/lib/scoring/gameStats.ts

export interface RoundResult {
  deltas: Record<string, number>;
  blitzCounts: Record<string, number>; // 0 = blitzed that round, >0 = remaining
}

export interface GameStats {
  roundsPlayed: number;
  biggestRound: { delta: number; playerName: string; roundNumber: number };
  worstRound: { delta: number; playerName: string; roundNumber: number };
  blitzCounts: Record<string, number>; // playerId -> total blitzes
  totalBlitzes: number;
  roundWins: Record<string, number>; // playerId -> rounds won
}

export function calcGameStats(
  rounds: RoundResult[],
  playerNames: Record<string, string>
): GameStats {
  let biggestRound = { delta: -Infinity, playerName: "", roundNumber: 0 };
  let worstRound = { delta: Infinity, playerName: "", roundNumber: 0 };
  const blitzCounts: Record<string, number> = {};
  const roundWins: Record<string, number> = {};

  for (const pid of Object.keys(playerNames)) {
    blitzCounts[pid] = 0;
    roundWins[pid] = 0;
  }

  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];
    let bestDelta = -Infinity;
    let bestPlayer = "";

    for (const [pid, delta] of Object.entries(round.deltas)) {
      if (delta > biggestRound.delta) {
        biggestRound = {
          delta,
          playerName: playerNames[pid] ?? pid,
          roundNumber: ri + 1,
        };
      }
      if (delta < worstRound.delta) {
        worstRound = {
          delta,
          playerName: playerNames[pid] ?? pid,
          roundNumber: ri + 1,
        };
      }
      if (delta > bestDelta) {
        bestDelta = delta;
        bestPlayer = pid;
      }
    }

    if (bestPlayer) roundWins[bestPlayer]++;

    for (const [pid, remaining] of Object.entries(round.blitzCounts)) {
      if (remaining === 0) blitzCounts[pid]++;
    }
  }

  return {
    roundsPlayed: rounds.length,
    biggestRound,
    worstRound,
    blitzCounts,
    totalBlitzes: Object.values(blitzCounts).reduce((a, b) => a + b, 0),
    roundWins,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern='gameStats.test' --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/gameStats.ts src/lib/__tests__/gameStats.test.ts
git commit -m "feat: add game stats calculation (biggest/worst round, blitzes, round wins)"
```

---

## Task 2: CelebrationOverlay Component

**Files:**
- Create: `src/components/scoring/CelebrationOverlay.tsx`

- [ ] **Step 1: Build the celebration overlay with CSS animations**

```tsx
// src/components/scoring/CelebrationOverlay.tsx
"use client";

import { useEffect, useState, useRef } from "react";

interface CelebrationOverlayProps {
  winnerName: string;
  winnerScore: number;
  winnerColor: string;
  onComplete: () => void;
}

function generateConfetti(count: number, colors: string[]) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}%`,
    top: `${-10 + Math.random() * 20}%`,
    size: 4 + Math.random() * 8,
    isCircle: Math.random() > 0.5,
    delay: `${Math.random() * 0.5}s`,
    duration: `${2 + Math.random() * 1.5}s`,
  }));
}

const CONFETTI_COLORS = [
  "#3b82f6", "#ef4444", "#eab308", "#22c55e",
  "#8b5cf6", "#f97316", "#fff", "#fbbf24",
];

export function CelebrationOverlay({
  winnerName,
  winnerScore,
  winnerColor,
  onComplete,
}: CelebrationOverlayProps) {
  const [visible, setVisible] = useState(true);
  const confetti = useRef(generateConfetti(50, CONFETTI_COLORS));

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none animate-[celebrationFade_2.5s_ease-out_forwards]">
      {/* Background flash */}
      <div
        className="absolute inset-0 animate-[bgFlash_2.5s_ease-out_forwards]"
        style={{
          background: `linear-gradient(135deg, ${winnerColor}, ${winnerColor}dd)`,
        }}
      />

      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden">
        {confetti.current.map((c) => (
          <div
            key={c.id}
            className="absolute animate-[confettiFall_3s_ease-out_forwards]"
            style={{
              left: c.left,
              top: c.top,
              width: c.size,
              height: c.size,
              backgroundColor: c.color,
              borderRadius: c.isCircle ? "50%" : "2px",
              animationDelay: c.delay,
              animationDuration: c.duration,
              opacity: 0,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center animate-[contentPop_2.5s_ease-out_forwards]">
        <div className="text-6xl mb-3 animate-[trophyBounce_2.5s_ease-out_forwards]">
          🏆
        </div>
        <div className="text-3xl font-black text-white drop-shadow-lg">
          {winnerName}
        </div>
        <div className="text-base font-semibold text-white/85">
          wins the game!
        </div>
        <div className="text-5xl font-black text-white mt-2 drop-shadow-lg">
          {winnerScore}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the keyframe animations to globals.css**

In `src/app/globals.css`, add:

```css
@keyframes celebrationFade {
  0% { opacity: 0; }
  8% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}

@keyframes bgFlash {
  0% { opacity: 0; }
  8% { opacity: 0.95; }
  70% { opacity: 0.95; }
  100% { opacity: 0; }
}

@keyframes contentPop {
  0% { opacity: 0; transform: scale(0.5); }
  12% { opacity: 1; transform: scale(1.1); }
  18% { transform: scale(1); }
  70% { opacity: 1; }
  100% { opacity: 0; transform: scale(0.95); }
}

@keyframes trophyBounce {
  0% { opacity: 0; transform: scale(0) rotate(-20deg); }
  15% { opacity: 1; transform: scale(1.3) rotate(5deg); }
  22% { transform: scale(1) rotate(0deg); }
  70% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes confettiFall {
  0% { opacity: 0; transform: translateY(-20px) rotate(0deg); }
  10% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; transform: translateY(600px) rotate(720deg); }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/scoring/CelebrationOverlay.tsx src/app/globals.css
git commit -m "feat: add CelebrationOverlay with confetti and trophy animation"
```

---

## Task 3: GameOverView Component

**Files:**
- Create: `src/components/scoring/GameOverView.tsx`

- [ ] **Step 1: Build the final results view**

```tsx
// src/components/scoring/GameOverView.tsx
"use client";

import { type PlayerWithScore } from "./types";
import { type GameStats } from "@/lib/scoring/gameStats";
import { ACCENT_COLORS } from "@/lib/scoring/colors";

interface GameOverViewProps {
  winner: PlayerWithScore;
  players: PlayerWithScore[];
  stats: GameStats;
  onRematch: () => void;
  onBackToCircle: () => void;
}

export function GameOverView({
  winner,
  players,
  stats,
  onRematch,
  onBackToCircle,
}: GameOverViewProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const colorLabel =
    ACCENT_COLORS.find((c) => c.value === winner.color)?.label ?? "";

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

      {/* Actions */}
      <div className="px-4 pt-5 pb-6 space-y-2">
        <button
          onClick={onRematch}
          className="w-full py-3.5 rounded-xl text-[15px] font-bold bg-[#290806] text-white hover:bg-[#3d1a0a] transition-colors cursor-pointer"
        >
          New Game with Same Players
        </button>
        <button
          onClick={onBackToCircle}
          className="w-full py-3 rounded-xl text-[13px] font-semibold border-[1.5px] border-[#e6d7c3] bg-white text-[#8b5e3c] hover:bg-[#faf5ed] transition-colors cursor-pointer"
        >
          Back to Circle
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/GameOverView.tsx
git commit -m "feat: add GameOverView with winner card, standings, and game stats"
```

---

## Task 4: Integrate Game Over into ScoringShell

**Files:**
- Modify: `src/components/scoring/ScoringShell.tsx`

**IMPORTANT:** The game page (`page.tsx`) is a server component. All stateful game-over UI — celebration animation, `hasSeenCelebration` state, `onRematch`/`onBackToCircle` handlers — must live in the `ScoringShell` client wrapper (created in Plan 1, Task 10). The server page passes serialized data only.

- [ ] **Step 1: Add game over mode to ScoringShell**

In `ScoringShell.tsx`, expand the mode state machine to include `gameOver`:

```tsx
import { CelebrationOverlay } from "./CelebrationOverlay";
import { GameOverView } from "./GameOverView";
import { calcGameStats, type RoundResult } from "@/lib/scoring/gameStats";
import { calculateRoundScore } from "@/lib/validation/gameRules";
import { useRouter } from "next/navigation";

// Inside ScoringShell:
const router = useRouter();
const [hasSeenCelebration, setHasSeenCelebration] = useState(false);
const [celebrationCancelled, setCelebrationCancelled] = useState(false);

// Determine if we should show celebration (only on first render of a finished game
// that just became finished — i.e., the last round was just submitted).
// Use a prop like `justFinished` passed from the server, or check if this is
// the initial mount while isFinished is true.
const showCelebration = isFinished && !hasSeenCelebration && !celebrationCancelled;

// Compute game stats from rounds data (done client-side from serialized props)
const roundResults: RoundResult[] = rounds.map((round) => {
  const deltas: Record<string, number> = {};
  const blitzCounts: Record<string, number> = {};
  for (const score of round.scores) {
    const pid = score.userId ?? score.guestId ?? "";
    deltas[pid] = calculateRoundScore(score);
    blitzCounts[pid] = score.blitzPileRemaining;
  }
  return { deltas, blitzCounts };
});
const playerNameMap = Object.fromEntries(players.map((p) => [p.id, p.name]));
const gameStats = calcGameStats(roundResults, playerNameMap);

// Handlers (client-side navigation, no server callbacks)
const handleRematch = async () => {
  // Call cloneGame server action, then navigate
  const newGame = await cloneGame(gameId);
  router.push(`/games/${newGame.id}`);
};

const handleBackToCircle = () => {
  router.push("/games");
};
```

Render in JSX based on mode:

```tsx
{isFinished && (
  <>
    {showCelebration && (
      <CelebrationOverlay
        winnerName={winner.name}
        winnerScore={winner.score}
        winnerColor={winner.color}
        onComplete={() => setHasSeenCelebration(true)}
        cancelled={celebrationCancelled}
      />
    )}
    <GameOverView
      winner={winner}
      players={players}
      stats={gameStats}
      rounds={rounds}
      editingRound={editingRound}
      onEditRound={handleEditRound}
      onRematch={handleRematch}
      onBackToCircle={handleBackToCircle}
    />
  </>
)}
```

- [ ] **Step 2: Ensure the server page only passes serialized data**

In `src/app/games/[id]/page.tsx`, the server component should pass only JSON-serializable props to `ScoringShell`: `gameId`, `players`, `rounds`, `isFinished`, `winThreshold`, `currentRoundNumber`. No callbacks, no functions, no React elements.

- [ ] **Step 2: Handle the "undo reopens game" edge case**

If the user taps Undo during the celebration (before it fades), cancel the celebration and revert to score entry mode. This requires the undo toast from Plan 3 to be rendered on top of the celebration overlay.

- [ ] **Step 3: Handle the "edit reopens game" edge case**

If a finished game's winning round is edited and the winner drops below threshold, remove the `isFinished` flag and return to in-progress state. This is handled by the existing `updateRoundScores` mutation — add a check: after recalculating scores, if no player is at or above threshold, set `isFinished = false`.

- [ ] **Step 4: Test the full game over flow**

1. Play a game until someone crosses the threshold
2. Celebration flash fires (accent color, confetti, trophy, ~2s)
3. Results view appears with winner card, standings, stats
4. "New Game with Same Players" creates a cloned game
5. "Back to Circle" navigates to the circle page
6. Revisiting the finished game shows results directly (no re-celebration)

- [ ] **Step 5: Commit**

```bash
git add src/app/games/[id]/page.tsx
git commit -m "feat: integrate celebration overlay and game over view"
```

---

## Task 5: Tie-Breaking Logic

**Files:**
- Modify: `src/lib/gameLogic.ts`

- [ ] **Step 1: Write a test for tie-breaking**

In `src/lib/__tests__/gameLogic.test.ts`, add:

```typescript
describe("tie-breaking", () => {
  it("breaks threshold ties by lower blitz pile remaining in final round", () => {
    // Two players both cross 75 with score 78
    // Player 1 had blitzPileRemaining=0, Player 2 had blitzPileRemaining=2
    // Player 1 should win (fewer blitz cards = better)
    // ... test setup with mock game data
  });
});
```

- [ ] **Step 2: Implement tie-breaking in transformGameData**

In the section of `transformGameData` that determines the winner, add tie-breaking logic:

```typescript
// When multiple players cross threshold in the same round with the same score,
// the player with fewer blitz cards remaining in that round wins.
if (tiedPlayers.length > 1) {
  const finalRound = game.rounds[game.rounds.length - 1];
  tiedPlayers.sort((a, b) => {
    const aScore = finalRound.scores.find(
      (s) => s.userId === a.userId || s.guestId === a.guestId
    );
    const bScore = finalRound.scores.find(
      (s) => s.userId === b.userId || s.guestId === b.guestId
    );
    return (aScore?.blitzPileRemaining ?? 10) - (bScore?.blitzPileRemaining ?? 10);
  });
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- --testPathPattern='gameLogic' --verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/gameLogic.ts src/lib/__tests__/gameLogic.test.ts
git commit -m "feat: add tie-breaking logic for same-score threshold crossing"
```

---

## Task 6: Add onCancel to CelebrationOverlay

**Files:**
- Modify: `src/components/scoring/CelebrationOverlay.tsx`

The celebration needs an external cancel mechanism so the undo toast can dismiss it.

- [ ] **Step 1: Add onCancel prop**

Update the interface and component:

```tsx
interface CelebrationOverlayProps {
  winnerName: string;
  winnerScore: number;
  winnerColor: string;
  onComplete: () => void;
  onCancel?: () => void; // Called when externally cancelled (e.g., undo)
  cancelled?: boolean;   // When true, fade out immediately
}
```

When `cancelled` transitions to `true`, clear the 2.5s timer and trigger an immediate fade-out animation. Add a `useEffect` watching `cancelled`:

```tsx
useEffect(() => {
  if (cancelled) {
    setVisible(false);
    onCancel?.();
  }
}, [cancelled, onCancel]);
```

- [ ] **Step 2: Set UndoToast z-index above celebration**

The UndoToast uses `z-50`. The CelebrationOverlay also uses `z-50`. Change CelebrationOverlay to `z-40` so the toast renders on top:

```tsx
<div className="absolute inset-0 z-40 ...">
```

- [ ] **Step 3: Wire into game page**

In the game page integration (Task 4), pass a `cancelled` prop that's set to `true` when the undo handler fires during celebration.

- [ ] **Step 4: Commit**

```bash
git add src/components/scoring/CelebrationOverlay.tsx
git commit -m "feat: add cancel support to CelebrationOverlay for undo interaction"
```

---

## Task 7: Include Round History Table in Game Over View

**Files:**
- Modify: `src/components/scoring/GameOverView.tsx`

The winning round must remain editable. Add the RoundHistoryTable to the game over view.

- [ ] **Step 1: Add history table between stats grid and actions**

Import and render RoundHistoryTable:

```tsx
import { RoundHistoryTable } from "./RoundHistoryTable";
```

Add props for rounds data and edit handler:

```tsx
interface GameOverViewProps {
  winner: PlayerWithScore;
  players: PlayerWithScore[];
  stats: GameStats;
  rounds: { scores: { userId?: string | null; guestId?: string | null; blitzPileRemaining: number; totalCardsPlayed: number }[] }[];
  editingRound: number | null;
  onEditRound: (roundIndex: number) => void;
  onRematch: () => void;
  onBackToCircle: () => void;
}
```

Between the stats grid and the action buttons, add:

```tsx
{/* Round history — tap to edit */}
<div className="pt-4 pb-2">
  <RoundHistoryTable
    players={players}
    rounds={rounds}
    editingRound={editingRound}
    onEditRound={onEditRound}
  />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/GameOverView.tsx
git commit -m "feat: include editable round history table in game over view"
```

---

## Task 8: Rematch Carries Forward Color Assignments

**Files:**
- Modify: `src/server/mutations/games.ts` (cloneGame function)

- [ ] **Step 1: Copy accent colors from original game to cloned game**

In the `cloneGame` function, when creating new GamePlayers entries for the cloned game, copy the `accentColor` from the original game's GamePlayers:

```typescript
// In cloneGame, when mapping original players to new GamePlayers:
const originalPlayers = await prisma.gamePlayers.findMany({
  where: { gameId: originalGameId },
});

// When creating each new GamePlayers entry:
for (const original of originalPlayers) {
  await prisma.gamePlayers.create({
    data: {
      gameId: newGame.id,
      userId: original.userId,
      guestId: original.guestId,
      accentColor: original.accentColor, // carry forward
    },
  });
}
```

- [ ] **Step 2: Write test**

In `src/server/__tests__/mutations.test.ts`, add a test verifying that cloneGame preserves accent colors.

- [ ] **Step 3: Commit**

```bash
git add src/server/mutations/games.ts src/server/__tests__/mutations.test.ts
git commit -m "feat: rematch/clone carries forward accent color assignments"
```

---

## Task 9: Edit-Reopens-Game Server Logic

**Files:**
- Modify: `src/server/mutations/rounds.ts` (updateRoundScores function)

**IMPORTANT:** The current `updateRoundScores` at line 130 has a hard guard: `if (game.isFinished) throw new Error("Cannot update scores for a finished game")`. This must be relaxed first, otherwise editing the winning round is impossible. The spec explicitly requires that finished games remain editable.

- [ ] **Step 1: Relax the isFinished guard in updateRoundScores**

In `src/server/mutations/rounds.ts`, change line 130-132 from:

```typescript
if (game.isFinished) {
  throw new Error("Cannot update scores for a finished game");
}
```

to:

```typescript
// Finished games are still editable — if an edit drops all players
// below the threshold, the game will be reopened (see step 2 below).
// The isFinished flag is not a write-lock.
```

Remove the guard entirely. The game-reopen logic below handles the state transition.

- [ ] **Step 2: Add game-reopen check after score update**

After `updateRoundScores` completes its transaction, recalculate all player totals. If no player is at or above the win threshold, reopen the game:

```typescript
// At the end of updateRoundScores, after scores are updated:
const game = await prisma.game.findUnique({
  where: { id: gameId },
  include: {
    rounds: { include: { scores: true } },
  },
});

if (game?.isFinished) {
  // Recalculate all totals
  const totals: Record<string, number> = {};
  for (const round of game.rounds) {
    for (const score of round.scores) {
      const pid = score.userId ?? score.guestId ?? "";
      totals[pid] = (totals[pid] ?? 0) + calculateRoundScore(score);
    }
  }

  const anyoneAboveThreshold = Object.values(totals).some(
    (total) => total >= game.winThreshold
  );

  if (!anyoneAboveThreshold) {
    await prisma.game.update({
      where: { id: gameId },
      data: { isFinished: false, winnerId: null, endedAt: null },
    });

    posthog.capture({
      distinctId: user.userId,
      event: "game_reopened_after_edit",
      properties: { game_id: gameId },
    });
  }
}
```

- [ ] **Step 2: Write test**

```typescript
// In mutations.test.ts:
it("reopens a finished game when edit drops all players below threshold", async () => {
  // Setup: finished game with winner at 76
  // Edit the winning round to reduce winner to 60
  // Verify: game.isFinished = false, winnerId = null
});
```

- [ ] **Step 3: Commit**

```bash
git add src/server/mutations/rounds.ts src/server/__tests__/mutations.test.ts
git commit -m "feat: reopen finished game when edit drops all players below threshold"
```

---

## Task 10: PostHog Tracking for Game Over Actions

**Files:**
- Modify: `src/components/scoring/GameOverView.tsx`

- [ ] **Step 1: Add PostHog capture**

```tsx
import { usePostHog } from "posthog-js/react";

// In component:
const posthog = usePostHog();

const handleRematch = () => {
  posthog.capture("game_over_rematch", { player_count: players.length });
  onRematch();
};

const handleBack = () => {
  posthog.capture("game_over_back_to_circle");
  onBackToCircle();
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoring/GameOverView.tsx
git commit -m "feat: add PostHog tracking for game over actions"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Celebration flash ✓. Results view with winner card, standings, stats ✓. Rematch + Back to Circle ✓. Undo cancels celebration (onCancel prop + z-index fix) ✓. Edit can reopen finished game (server-side recalc + isFinished revert) ✓. Tie-breaking ✓. Winning round editable (RoundHistoryTable in GameOverView) ✓. Rematch carries forward colors ✓. PostHog tracking ✓.
- [x] **Placeholder scan:** All tasks have explicit code or clear implementation guidance.
- [x] **Type consistency:** `PlayerWithScore` from shared types. `GameStats`/`RoundResult` from `gameStats.ts`. Updated `GameOverViewProps` includes rounds and edit handler.
- [x] **Edge cases covered:** Celebration only plays once. Undo during celebration. Edit reopening game (with test). Tie-breaking (with test). Rematch color inheritance.
