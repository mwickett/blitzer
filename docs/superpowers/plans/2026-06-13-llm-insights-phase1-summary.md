# LLM Insights — Phase 1 (M0a Claude foundation + M1 Post-game summary) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a Dutch Blitz game finishes, generate a warm, neutral, fact-grounded narrative recap with Claude and show it on the game page — built on the official `@anthropic-ai/sdk`.

**Architecture:** Pure functions build a deterministic `GameRecapFacts` payload from the already-loaded game (reusing `transformGameData` + `calcGameStats`), hash it for idempotency, pseudonymize player names, prompt Claude (Opus 4.8) for prose, then rehydrate real names. A durable `GameSummary` row (status: `pending`/`ready`/`failed`/`insufficient_data`) is the unit of work — written from the **primary** DB at game-finish (no replica lag), generated asynchronously via Next's `after()`, retryable via a sweep. Reads use the replica.

**Tech Stack:** Next.js 16 (App Router/RSC), TypeScript, Prisma 7 (`@prisma/adapter-pg`, Postgres/Neon), `@anthropic-ai/sdk`, Jest + Testing Library.

**Scope note:** Phase 1 deliberately uses the `GameSummary` row itself as the durable job unit (status + `retryCount`), not the generic `InsightJob` table from the spec — that table is only justified once tiles add a second job kind (later phase). Pseudonymization is name-keyed here; the playerKey-keyed version lands with the chat phase (M2). Both are noted in the spec's open items.

---

### Task 0: Create the Phase-1 branch off the integration branch

**Files:** none (git only)

- [ ] **Step 1: Branch from the integration branch**

```bash
git checkout feature/llm-insights
git pull --ff-only 2>/dev/null || true
git checkout -b feature/llm-insights-p1-summary
```

- [ ] **Step 2: Confirm the branch + clean tree (spec present)**

Run: `git status --short && git branch --show-current`
Expected: branch is `feature/llm-insights-p1-summary`; `docs/superpowers/specs/2026-06-13-llm-insights-design.md` already tracked; no other staged changes.

---

## M0a — Claude foundation

### Task 1: Add the Anthropic SDK + Claude client singleton

**Files:**
- Modify: `package.json` (add dependency)
- Create: `src/server/ai/claude.ts`
- Create: `src/server/ai/__tests__/claude.test.ts`
- Env: `.env` (add `ANTHROPIC_API_KEY`), `.env.example` if it exists

- [ ] **Step 1: Install the SDK**

Run: `npm install @anthropic-ai/sdk`
Expected: `@anthropic-ai/sdk` appears in `package.json` dependencies; install succeeds.

- [ ] **Step 2: Add the API key to env**

Add to `.env` (do NOT commit a real key):

```
ANTHROPIC_API_KEY=sk-ant-...
```

If `.env.example` exists, add a placeholder line `ANTHROPIC_API_KEY=` there too.

- [ ] **Step 3: Write the failing test**

Create `src/server/ai/__tests__/claude.test.ts`:

```ts
const create = jest.fn();

jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: class {
    messages = { create };
  },
}));

import { generateSummaryText, CLAUDE_SUMMARY_MODEL } from "@/server/ai/claude";

describe("generateSummaryText", () => {
  beforeEach(() => create.mockReset());

  it("calls Claude with the summary model and returns concatenated text + token total", async () => {
    create.mockResolvedValue({
      content: [
        { type: "text", text: "A close " },
        { type: "text", text: "game." },
      ],
      usage: { input_tokens: 30, output_tokens: 12 },
    });

    const result = await generateSummaryText("SYSTEM", "USER");

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].model).toBe(CLAUDE_SUMMARY_MODEL);
    expect(CLAUDE_SUMMARY_MODEL).toBe("claude-opus-4-8");
    expect(result.text).toBe("A close game.");
    expect(result.tokensUsed).toBe(42);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- src/server/ai/__tests__/claude.test.ts`
Expected: FAIL — cannot find module `@/server/ai/claude`.

- [ ] **Step 5: Write the implementation**

Create `src/server/ai/claude.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";

// Mirrors the Prisma singleton pattern in src/server/db/db.ts so hot-reload in
// dev doesn't open a new client per request.
const claudeSingleton = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

declare const globalThis: {
  claudeGlobal: ReturnType<typeof claudeSingleton>;
} & typeof global;

const claude = globalThis.claudeGlobal ?? claudeSingleton();

export default claude;

if (process.env.NODE_ENV !== "production") globalThis.claudeGlobal = claude;

export const CLAUDE_SUMMARY_MODEL = "claude-opus-4-8";

export interface GeneratedText {
  text: string;
  tokensUsed: number;
}

// Single, non-streaming Messages call. Adaptive thinking + low effort: the task
// is short and runs async (latency-insensitive), so we trade a little cost for
// reliably grounded prose. No sampling params (removed on Opus 4.8).
export async function generateSummaryText(
  system: string,
  user: string
): Promise<GeneratedText> {
  const res = await claude.messages.create({
    model: CLAUDE_SUMMARY_MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: [{ type: "text", text: system }],
    messages: [{ role: "user", content: user }],
  } as Anthropic.MessageCreateParamsNonStreaming);

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const tokensUsed =
    (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0);

  return { text, tokensUsed };
}
```

> If TypeScript rejects `thinking` / `output_config` (installed SDK types lag the API), keep the `as Anthropic.MessageCreateParamsNonStreaming` cast — the wire fields are correct per the Claude API.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/server/ai/__tests__/claude.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/server/ai/claude.ts src/server/ai/__tests__/claude.test.ts
git commit -m "feat(insights): add Anthropic SDK + Claude summary client"
```

---

### Task 2: Add the `GameSummary` model + migration

**Files:**
- Modify: `src/server/db/schema.prisma`

- [ ] **Step 1: Add the enum, model, and back-relation**

In `src/server/db/schema.prisma`, add a back-relation field to `Game` (inside the `Game` model, alongside `rounds`):

```prisma
  summaries      GameSummary[]
```

Then append at the end of the file:

```prisma
enum GameSummaryStatus {
  pending
  ready
  failed
  insufficient_data
}

model GameSummary {
  id              String            @id @default(uuid())
  gameId          String            @map("game_id")
  organizationId  String?           @map("organization_id")
  audienceUserId  String?           @map("audience_user_id")
  status          GameSummaryStatus @default(pending)
  content         String?
  model           String?
  promptVersion   String            @map("prompt_version")
  sourceStatsHash String            @map("source_stats_hash")
  sourceUpdatedAt DateTime          @map("source_updated_at")
  tokensUsed      Int?              @map("tokens_used")
  error           String?
  retryCount      Int               @default(0) @map("retry_count")
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  game            Game              @relation(fields: [gameId], references: [id])

  @@unique([gameId, promptVersion])
  @@index([status])
  @@index([gameId])
}
```

> `audienceUserId` is always null in MVP (neutral recap); the unique key is `(gameId, promptVersion)` so there is exactly one current summary per game per prompt version, and `upsert` has a clean target. `sourceStatsHash` is stored (not in the unique key) so we can detect score changes after finish and regenerate.

- [ ] **Step 2: Create + apply the migration (regenerates the client)**

Run: `npx prisma migrate dev --name add_game_summary`
Expected: a new migration under `src/server/db/migrations/`, applied to the dev DB; Prisma client regenerated (so `prisma.gameSummary` exists).

- [ ] **Step 3: Verify the client type compiles**

Run: `npm run typecheck`
Expected: PASS (no errors). Confirms `prisma.gameSummary` and `GameSummaryStatus` are generated.

- [ ] **Step 4: Commit**

```bash
git add src/server/db/schema.prisma src/server/db/migrations
git commit -m "feat(insights): add GameSummary model + migration"
```

---

## M1 — Post-game summary

### Task 3: `buildGameRecap` — deterministic fact builder (pure)

**Files:**
- Create: `src/lib/insights/gameRecap.ts`
- Create: `src/lib/insights/__tests__/gameRecap.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/insights/__tests__/gameRecap.test.ts`:

```ts
import { buildGameRecap } from "@/lib/insights/gameRecap";
import type { GameWithPlayersAndScores } from "@/lib/gameLogic";

// Minimal fixture: 2 players, 2 rounds. Player "u1" (Mike) wins.
// Round score = totalCardsPlayed - 2*blitzPileRemaining.
function fixture(): GameWithPlayersAndScores {
  const base = {
    createdAt: new Date(),
    endedAt: null,
    winnerId: null,
    organizationId: "org_1",
    isFinished: true,
  };
  return {
    id: "game_1",
    winThreshold: 30,
    ...base,
    players: [
      { id: "gp1", gameId: "game_1", userId: "u1", guestId: null, accentColor: null,
        user: { id: "u1", username: "Mike" } as never, guestUser: null },
      { id: "gp2", gameId: "game_1", userId: "u2", guestId: null, accentColor: null,
        user: { id: "u2", username: "Sarah" } as never, guestUser: null },
    ],
    rounds: [
      { id: "r1", gameId: "game_1", round: 1, createdAt: new Date(),
        scores: [
          { id: "s1", roundId: "r1", userId: "u1", guestId: null, totalCardsPlayed: 20, blitzPileRemaining: 0, createdAt: new Date(), updatedAt: new Date() },
          { id: "s2", roundId: "r1", userId: "u2", guestId: null, totalCardsPlayed: 14, blitzPileRemaining: 3, createdAt: new Date(), updatedAt: new Date() },
        ] },
      { id: "r2", gameId: "game_1", round: 2, createdAt: new Date(),
        scores: [
          { id: "s3", roundId: "r2", userId: "u1", guestId: null, totalCardsPlayed: 18, blitzPileRemaining: 2, createdAt: new Date(), updatedAt: new Date() },
          { id: "s4", roundId: "r2", userId: "u2", guestId: null, totalCardsPlayed: 10, blitzPileRemaining: 0, createdAt: new Date(), updatedAt: new Date() },
        ] },
    ],
  } as unknown as GameWithPlayersAndScores;
}

describe("buildGameRecap", () => {
  it("computes standings, winner, and round counts", () => {
    const facts = buildGameRecap(fixture());
    // u1: round1 = 20-0 = 20, round2 = 18-4 = 14 -> 34 (>= 30 threshold)
    // u2: round1 = 14-6 = 8,  round2 = 10-0 = 10 -> 18
    expect(facts.roundsPlayed).toBe(2);
    expect(facts.playerCount).toBe(2);
    expect(facts.winnerName).toBe("Mike");
    expect(facts.standings[0].name).toBe("Mike");
    expect(facts.standings[0].total).toBe(34);
    expect(facts.standings[0].rank).toBe(1);
    expect(facts.standings[1].total).toBe(18);
  });

  it("identifies the biggest round and the blitz leader", () => {
    const facts = buildGameRecap(fixture());
    expect(facts.biggestRound.delta).toBe(20);
    expect(facts.biggestRound.playerName).toBe("Mike");
    expect(facts.totalBlitzes).toBe(2); // u1 r1, u2 r2
    expect(facts.blitzLeader).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/insights/__tests__/gameRecap.test.ts`
Expected: FAIL — cannot find module `@/lib/insights/gameRecap`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/insights/gameRecap.ts`:

```ts
import transformGameData, { type GameWithPlayersAndScores } from "@/lib/gameLogic";
import { calcGameStats, type RoundResult, type GameStats } from "@/lib/scoring/gameStats";
import { calculateRoundScore } from "@/lib/validation/gameRules";

export const MIN_ROUNDS_FOR_SUMMARY = 2;
export const MIN_PLAYERS_FOR_SUMMARY = 2;

export interface RecapStanding {
  playerKey: string; // userId or guestId
  name: string;
  total: number;
  isWinner: boolean;
  rank: number;
}

export interface GameRecapFacts {
  gameId: string;
  organizationId: string | null;
  winThreshold: number;
  roundsPlayed: number;
  playerCount: number;
  standings: RecapStanding[];
  winnerName: string | null;
  tiebreakUsed: boolean;
  biggestRound: GameStats["biggestRound"];
  worstRound: GameStats["worstRound"];
  blitzLeader: { name: string; blitzes: number } | null;
  totalBlitzes: number;
  leadChanges: number;
}

export function buildGameRecap(
  game: GameWithPlayersAndScores
): GameRecapFacts {
  const display = transformGameData(game);
  const playerNames: Record<string, string> = {};
  for (const d of display) playerNames[d.id] = d.username;

  // Per-round deltas + blitz counts, keyed by playerKey (userId || guestId)
  const rounds: RoundResult[] = game.rounds.map((round) => {
    const deltas: Record<string, number> = {};
    const blitzCounts: Record<string, number> = {};
    for (const id of Object.keys(playerNames)) {
      deltas[id] = 0;
      blitzCounts[id] = 0;
    }
    for (const s of round.scores) {
      const key = s.userId || s.guestId;
      if (!key || !(key in playerNames)) continue;
      deltas[key] = calculateRoundScore({
        blitzPileRemaining: s.blitzPileRemaining,
        totalCardsPlayed: s.totalCardsPlayed,
      });
      if (s.blitzPileRemaining === 0) blitzCounts[key] += 1;
    }
    return { deltas, blitzCounts };
  });

  const stats = calcGameStats(rounds, playerNames);

  const sorted = [...display].sort((a, b) => b.total - a.total);
  const standings: RecapStanding[] = sorted.map((d, i) => ({
    playerKey: d.id,
    name: d.username,
    total: d.total,
    isWinner: !!d.isWinner,
    rank: i + 1,
  }));

  const winner = display.find((d) => d.isWinner) ?? null;
  const topTotal = sorted.length ? sorted[0].total : 0;
  const reachedTop = display.filter(
    (d) => d.total >= game.winThreshold && d.total === topTotal
  );
  const tiebreakUsed = reachedTop.length > 1;

  let blitzLeader: { name: string; blitzes: number } | null = null;
  for (const [key, n] of Object.entries(stats.blitzCounts)) {
    if (n > 0 && (!blitzLeader || n > blitzLeader.blitzes)) {
      blitzLeader = { name: playerNames[key] ?? key, blitzes: n };
    }
  }

  // Lead changes: cumulative leader transitions round over round
  const cumulative: Record<string, number> = {};
  for (const id of Object.keys(playerNames)) cumulative[id] = 0;
  let prevLeader: string | null = null;
  let leadChanges = 0;
  for (const r of rounds) {
    for (const [id, delta] of Object.entries(r.deltas)) cumulative[id] += delta;
    let leader: string | null = null;
    let best = -Infinity;
    for (const [id, total] of Object.entries(cumulative)) {
      if (total > best) {
        best = total;
        leader = id;
      }
    }
    if (leader && prevLeader && leader !== prevLeader) leadChanges++;
    prevLeader = leader;
  }

  return {
    gameId: game.id,
    organizationId: game.organizationId ?? null,
    winThreshold: game.winThreshold,
    roundsPlayed: stats.roundsPlayed,
    playerCount: display.length,
    standings,
    winnerName: winner?.username ?? null,
    tiebreakUsed,
    biggestRound: stats.biggestRound,
    worstRound: stats.worstRound,
    blitzLeader,
    totalBlitzes: stats.totalBlitzes,
    leadChanges,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/insights/__tests__/gameRecap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/gameRecap.ts src/lib/insights/__tests__/gameRecap.test.ts
git commit -m "feat(insights): buildGameRecap deterministic fact builder"
```

---

### Task 4: `hashRecapFacts` — stable hash for idempotency

**Files:**
- Create: `src/lib/insights/recapHash.ts`
- Create: `src/lib/insights/__tests__/recapHash.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/insights/__tests__/recapHash.test.ts`:

```ts
import { hashRecapFacts, stableStringify } from "@/lib/insights/recapHash";
import type { GameRecapFacts } from "@/lib/insights/gameRecap";

const facts = (overrides: Partial<GameRecapFacts> = {}): GameRecapFacts => ({
  gameId: "g1",
  organizationId: "o1",
  winThreshold: 75,
  roundsPlayed: 3,
  playerCount: 2,
  standings: [
    { playerKey: "u1", name: "Mike", total: 80, isWinner: true, rank: 1 },
    { playerKey: "u2", name: "Sarah", total: 40, isWinner: false, rank: 2 },
  ],
  winnerName: "Mike",
  tiebreakUsed: false,
  biggestRound: { delta: 20, playerName: "Mike", roundNumber: 1 },
  worstRound: { delta: -4, playerName: "Sarah", roundNumber: 2 },
  blitzLeader: { name: "Mike", blitzes: 2 },
  totalBlitzes: 3,
  leadChanges: 1,
  ...overrides,
});

describe("hashRecapFacts", () => {
  it("is stable for equal facts regardless of key order", () => {
    expect(hashRecapFacts(facts())).toBe(hashRecapFacts(facts()));
  });

  it("changes when a number changes", () => {
    expect(hashRecapFacts(facts())).not.toBe(
      hashRecapFacts(facts({ totalBlitzes: 4 }))
    );
  });

  it("stableStringify orders object keys", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/insights/__tests__/recapHash.test.ts`
Expected: FAIL — cannot find module `@/lib/insights/recapHash`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/insights/recapHash.ts`:

```ts
import { createHash } from "crypto";
import type { GameRecapFacts } from "./gameRecap";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`
  );
  return `{${entries.join(",")}}`;
}

export function hashRecapFacts(facts: GameRecapFacts): string {
  return createHash("sha256").update(stableStringify(facts)).digest("hex");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/insights/__tests__/recapHash.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/recapHash.ts src/lib/insights/__tests__/recapHash.test.ts
git commit -m "feat(insights): stable recap fact hashing"
```

---

### Task 5: `pseudonymizeRecap` / `rehydrateNames` — keep names out of the LLM

**Files:**
- Create: `src/lib/insights/pseudonymize.ts`
- Create: `src/lib/insights/__tests__/pseudonymize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/insights/__tests__/pseudonymize.test.ts`:

```ts
import { pseudonymizeRecap, rehydrateNames } from "@/lib/insights/pseudonymize";
import type { GameRecapFacts } from "@/lib/insights/gameRecap";

const facts: GameRecapFacts = {
  gameId: "g1",
  organizationId: "o1",
  winThreshold: 75,
  roundsPlayed: 3,
  playerCount: 2,
  standings: [
    { playerKey: "u1", name: "Mike", total: 80, isWinner: true, rank: 1 },
    { playerKey: "u2", name: "Sarah", total: 40, isWinner: false, rank: 2 },
  ],
  winnerName: "Mike",
  tiebreakUsed: false,
  biggestRound: { delta: 20, playerName: "Mike", roundNumber: 1 },
  worstRound: { delta: -4, playerName: "Sarah", roundNumber: 2 },
  blitzLeader: { name: "Mike", blitzes: 2 },
  totalBlitzes: 3,
  leadChanges: 1,
};

describe("pseudonymizeRecap", () => {
  it("replaces real names with positional pseudonyms", () => {
    const { facts: px, nameMap } = pseudonymizeRecap(facts);
    expect(px.winnerName).toBe("Player A");
    expect(px.standings[0].name).toBe("Player A");
    expect(px.standings[1].name).toBe("Player B");
    expect(px.biggestRound.playerName).toBe("Player A");
    expect(px.blitzLeader?.name).toBe("Player A");
    expect(nameMap).toEqual({ "Player A": "Mike", "Player B": "Sarah" });
  });

  it("rehydrates pseudonyms back to real names", () => {
    const { nameMap } = pseudonymizeRecap(facts);
    expect(
      rehydrateNames("Player A edged out Player B.", nameMap)
    ).toBe("Mike edged out Sarah.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/insights/__tests__/pseudonymize.test.ts`
Expected: FAIL — cannot find module `@/lib/insights/pseudonymize`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/insights/pseudonymize.ts`:

```ts
import type { GameRecapFacts } from "./gameRecap";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface Pseudonymized {
  facts: GameRecapFacts;
  nameMap: Record<string, string>; // pseudonym -> real name
}

// Names are positional by standings rank, so the mapping is deterministic.
// NOTE: two players sharing a display name collapse to one pseudonym here; the
// playerKey-keyed version arrives with the chat phase (M2). Tracked in the spec.
export function pseudonymizeRecap(facts: GameRecapFacts): Pseudonymized {
  const realToPseudo: Record<string, string> = {};
  facts.standings.forEach((s, i) => {
    if (!(s.name in realToPseudo)) {
      realToPseudo[s.name] = `Player ${ALPHABET[i] ?? String(i)}`;
    }
  });

  const px = (name: string | null): string | null =>
    name == null ? null : realToPseudo[name] ?? name;

  const pseudoFacts: GameRecapFacts = {
    ...facts,
    standings: facts.standings.map((s) => ({
      ...s,
      name: realToPseudo[s.name] ?? s.name,
    })),
    winnerName: px(facts.winnerName),
    biggestRound: { ...facts.biggestRound, playerName: px(facts.biggestRound.playerName)! },
    worstRound: { ...facts.worstRound, playerName: px(facts.worstRound.playerName)! },
    blitzLeader: facts.blitzLeader
      ? { ...facts.blitzLeader, name: px(facts.blitzLeader.name)! }
      : null,
  };

  const nameMap: Record<string, string> = {};
  for (const [real, pseudo] of Object.entries(realToPseudo)) nameMap[pseudo] = real;

  return { facts: pseudoFacts, nameMap };
}

export function rehydrateNames(
  text: string,
  nameMap: Record<string, string>
): string {
  let out = text;
  for (const [pseudo, real] of Object.entries(nameMap)) {
    out = out.split(pseudo).join(real);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/insights/__tests__/pseudonymize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/pseudonymize.ts src/lib/insights/__tests__/pseudonymize.test.ts
git commit -m "feat(insights): pseudonymize player names before the LLM"
```

---

### Task 6: `buildSummaryPrompt` — the prompt contract (pure)

**Files:**
- Create: `src/lib/insights/summaryPrompt.ts`
- Create: `src/lib/insights/__tests__/summaryPrompt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/insights/__tests__/summaryPrompt.test.ts`:

```ts
import {
  buildSummaryPrompt,
  PROMPT_VERSION,
  DEFAULT_SUMMARY_OPTIONS,
} from "@/lib/insights/summaryPrompt";
import type { GameRecapFacts } from "@/lib/insights/gameRecap";

const facts: GameRecapFacts = {
  gameId: "g1", organizationId: "o1", winThreshold: 75, roundsPlayed: 3,
  playerCount: 2,
  standings: [
    { playerKey: "p1", name: "Player A", total: 80, isWinner: true, rank: 1 },
    { playerKey: "p2", name: "Player B", total: 40, isWinner: false, rank: 2 },
  ],
  winnerName: "Player A", tiebreakUsed: false,
  biggestRound: { delta: 20, playerName: "Player A", roundNumber: 1 },
  worstRound: { delta: -4, playerName: "Player B", roundNumber: 2 },
  blitzLeader: { name: "Player A", blitzes: 2 }, totalBlitzes: 3, leadChanges: 1,
};

describe("buildSummaryPrompt", () => {
  it("forbids second-person and embeds the facts", () => {
    const { system, user } = buildSummaryPrompt(facts, DEFAULT_SUMMARY_OPTIONS);
    expect(system.toLowerCase()).toContain("never invent");
    expect(system).toMatch(/do not address.*"you"/i);
    expect(user).toContain("Player A");
    expect(user).toContain('"winnerName"');
  });

  it("exposes a stable prompt version", () => {
    expect(PROMPT_VERSION).toBe("summary-v1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/insights/__tests__/summaryPrompt.test.ts`
Expected: FAIL — cannot find module `@/lib/insights/summaryPrompt`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/insights/summaryPrompt.ts`:

```ts
import type { GameRecapFacts } from "./gameRecap";

export const PROMPT_VERSION = "summary-v1";

export interface SummaryOptions {
  perspective: "neutral";
  tone: "warm";
  length: "paragraph";
}

export const DEFAULT_SUMMARY_OPTIONS: SummaryOptions = {
  perspective: "neutral",
  tone: "warm",
  length: "paragraph",
};

export function buildSummaryPrompt(
  facts: GameRecapFacts,
  _opts: SummaryOptions = DEFAULT_SUMMARY_OPTIONS
): { system: string; user: string } {
  const system = [
    "You are a Dutch Blitz game announcer writing a short, warm, neutral recap of a finished game.",
    "Scoring: each round a player scores (cards played) minus 2 times (cards left in their Blitz pile); first to the win threshold wins.",
    "RULES:",
    '- Only state facts present in the provided JSON. Never invent or infer numbers, names, or events.',
    '- Neutral broadcaster voice. Do NOT address any player as "you".',
    "- One warm paragraph, roughly 3 to 5 sentences. No headings, no bullet points, no preamble, no sign-off.",
  ].join("\n");

  const user =
    "Game facts (JSON):\n" +
    JSON.stringify(facts, null, 2) +
    "\n\nWrite the recap paragraph.";

  return { system, user };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/insights/__tests__/summaryPrompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/summaryPrompt.ts src/lib/insights/__tests__/summaryPrompt.test.ts
git commit -m "feat(insights): summary prompt contract + version"
```

---

### Task 7: `findUngroundedNumbers` — fact-grounding guard (eval seed)

**Files:**
- Create: `src/lib/insights/grounding.ts`
- Create: `src/lib/insights/__tests__/grounding.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/insights/__tests__/grounding.test.ts`:

```ts
import { findUngroundedNumbers, collectFactNumbers } from "@/lib/insights/grounding";
import type { GameRecapFacts } from "@/lib/insights/gameRecap";

const facts: GameRecapFacts = {
  gameId: "g1", organizationId: "o1", winThreshold: 75, roundsPlayed: 3,
  playerCount: 2,
  standings: [
    { playerKey: "p1", name: "Player A", total: 80, isWinner: true, rank: 1 },
    { playerKey: "p2", name: "Player B", total: 40, isWinner: false, rank: 2 },
  ],
  winnerName: "Player A", tiebreakUsed: false,
  biggestRound: { delta: 20, playerName: "Player A", roundNumber: 1 },
  worstRound: { delta: -4, playerName: "Player B", roundNumber: 2 },
  blitzLeader: { name: "Player A", blitzes: 2 }, totalBlitzes: 3, leadChanges: 1,
};

describe("findUngroundedNumbers", () => {
  it("returns nothing when every number is grounded", () => {
    const text = "Player A reached 80 over 3 rounds, beating 40.";
    expect(findUngroundedNumbers(text, facts)).toEqual([]);
  });

  it("flags a fabricated number", () => {
    const text = "Player A scored a record 999 points.";
    expect(findUngroundedNumbers(text, facts)).toContain("999");
  });

  it("collects fact numbers as strings", () => {
    expect(collectFactNumbers(facts).has("80")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/insights/__tests__/grounding.test.ts`
Expected: FAIL — cannot find module `@/lib/insights/grounding`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/insights/grounding.ts`:

```ts
import type { GameRecapFacts } from "./gameRecap";

export function collectFactNumbers(facts: GameRecapFacts): Set<string> {
  const nums = new Set<string>();
  const walk = (v: unknown): void => {
    if (typeof v === "number") nums.add(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(facts);
  return nums;
}

// Soft guard: any integer in the prose that is not present in the facts is a
// candidate hallucination. Used both as a runtime warning and as the seed of
// the fact-based eval. Ordinals like ranks 1..N are already in the facts.
export function findUngroundedNumbers(
  text: string,
  facts: GameRecapFacts
): string[] {
  const allowed = collectFactNumbers(facts);
  const inText = text.match(/-?\d+/g) ?? [];
  return inText.filter((n) => !allowed.has(n));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/insights/__tests__/grounding.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/grounding.ts src/lib/insights/__tests__/grounding.test.ts
git commit -m "feat(insights): fact-grounding guard for summaries"
```

---

### Task 8: `generateGameSummary` orchestration + retry sweep

**Files:**
- Create: `src/server/ai/summary.ts`
- Create: `src/server/ai/__tests__/summary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/ai/__tests__/summary.test.ts`:

```ts
const findUnique = jest.fn();
const upsert = jest.fn();
const update = jest.fn();

jest.mock("@/server/db/db", () => ({
  __esModule: true,
  default: { gameSummary: { findUnique, upsert, update } },
}));

const getGameById = jest.fn();
jest.mock("@/server/queries/games", () => ({
  __esModule: true,
  getGameById: (...a: unknown[]) => getGameById(...a),
}));

const generateSummaryText = jest.fn();
jest.mock("@/server/ai/claude", () => ({
  __esModule: true,
  CLAUDE_SUMMARY_MODEL: "claude-opus-4-8",
  generateSummaryText: (...a: unknown[]) => generateSummaryText(...a),
}));

import { generateGameSummary } from "@/server/ai/summary";
import type { GameWithPlayersAndScores } from "@/lib/gameLogic";

function readyGame(): GameWithPlayersAndScores {
  return {
    id: "game_1", winThreshold: 30, organizationId: "org_1", isFinished: true,
    createdAt: new Date(), endedAt: null, winnerId: null,
    players: [
      { id: "gp1", gameId: "game_1", userId: "u1", guestId: null, accentColor: null, user: { id: "u1", username: "Mike" } as never, guestUser: null },
      { id: "gp2", gameId: "game_1", userId: "u2", guestId: null, accentColor: null, user: { id: "u2", username: "Sarah" } as never, guestUser: null },
    ],
    rounds: [
      { id: "r1", gameId: "game_1", round: 1, createdAt: new Date(), scores: [
        { id: "s1", roundId: "r1", userId: "u1", guestId: null, totalCardsPlayed: 20, blitzPileRemaining: 0, createdAt: new Date(), updatedAt: new Date() },
        { id: "s2", roundId: "r1", userId: "u2", guestId: null, totalCardsPlayed: 14, blitzPileRemaining: 3, createdAt: new Date(), updatedAt: new Date() },
      ] },
      { id: "r2", gameId: "game_1", round: 2, createdAt: new Date(), scores: [
        { id: "s3", roundId: "r2", userId: "u1", guestId: null, totalCardsPlayed: 18, blitzPileRemaining: 2, createdAt: new Date(), updatedAt: new Date() },
        { id: "s4", roundId: "r2", userId: "u2", guestId: null, totalCardsPlayed: 10, blitzPileRemaining: 0, createdAt: new Date(), updatedAt: new Date() },
      ] },
    ],
  } as unknown as GameWithPlayersAndScores;
}

beforeEach(() => {
  findUnique.mockReset(); upsert.mockReset(); update.mockReset();
  getGameById.mockReset(); generateSummaryText.mockReset();
  upsert.mockResolvedValue({}); update.mockResolvedValue({});
});

describe("generateGameSummary", () => {
  it("writes a ready summary with rehydrated names", async () => {
    getGameById.mockResolvedValue(readyGame());
    findUnique.mockResolvedValue(null);
    generateSummaryText.mockResolvedValue({ text: "Player A edged Player B.", tokensUsed: 42 });

    await generateGameSummary("game_1");

    const ready = upsert.mock.calls.find((c) => c[0].update.status === "ready");
    expect(ready).toBeDefined();
    expect(ready![0].update.content).toBe("Mike edged Sarah.");
    expect(ready![0].update.model).toBe("claude-opus-4-8");
    expect(ready![0].update.tokensUsed).toBe(42);
    expect(generateSummaryText).toHaveBeenCalledTimes(1);
  });

  it("marks insufficient_data and skips the LLM for a 1-round game", async () => {
    const g = readyGame();
    g.rounds = [g.rounds[0]];
    getGameById.mockResolvedValue(g);
    findUnique.mockResolvedValue(null);

    await generateGameSummary("game_1");

    expect(generateSummaryText).not.toHaveBeenCalled();
    const call = upsert.mock.calls.at(-1)!;
    expect(call[0].update.status).toBe("insufficient_data");
  });

  it("records failed status when the LLM call throws", async () => {
    getGameById.mockResolvedValue(readyGame());
    findUnique.mockResolvedValue(null);
    generateSummaryText.mockRejectedValue(new Error("boom"));

    await generateGameSummary("game_1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed", error: "boom" }),
      })
    );
  });

  it("is idempotent when a ready summary already matches the hash", async () => {
    getGameById.mockResolvedValue(readyGame());
    // First compute the hash the way the code will, by letting it run once.
    findUnique.mockResolvedValueOnce(null);
    generateSummaryText.mockResolvedValue({ text: "Player A wins.", tokensUsed: 5 });
    await generateGameSummary("game_1");
    const storedHash = upsert.mock.calls.at(-1)![0].create.sourceStatsHash as string;

    upsert.mockClear(); generateSummaryText.mockClear();
    findUnique.mockResolvedValue({ status: "ready", sourceStatsHash: storedHash });

    await generateGameSummary("game_1");
    expect(generateSummaryText).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/ai/__tests__/summary.test.ts`
Expected: FAIL — cannot find module `@/server/ai/summary`.

- [ ] **Step 3: Write the implementation**

Create `src/server/ai/summary.ts`:

```ts
import prisma from "@/server/db/db";
import { getGameById } from "@/server/queries/games";
import type { GameWithPlayersAndScores } from "@/lib/gameLogic";
import {
  buildGameRecap,
  MIN_ROUNDS_FOR_SUMMARY,
  MIN_PLAYERS_FOR_SUMMARY,
  type GameRecapFacts,
} from "@/lib/insights/gameRecap";
import { hashRecapFacts } from "@/lib/insights/recapHash";
import { pseudonymizeRecap, rehydrateNames } from "@/lib/insights/pseudonymize";
import {
  buildSummaryPrompt,
  PROMPT_VERSION,
  DEFAULT_SUMMARY_OPTIONS,
} from "@/lib/insights/summaryPrompt";
import { findUngroundedNumbers } from "@/lib/insights/grounding";
import { generateSummaryText, CLAUDE_SUMMARY_MODEL } from "./claude";

type Extra = {
  status: "pending" | "ready" | "failed" | "insufficient_data";
  content?: string;
  model?: string;
  tokensUsed?: number;
};

async function writeSummary(
  facts: GameRecapFacts,
  hash: string,
  sourceUpdatedAt: Date,
  extra: Extra
): Promise<void> {
  await prisma.gameSummary.upsert({
    where: {
      gameId_promptVersion: {
        gameId: facts.gameId,
        promptVersion: PROMPT_VERSION,
      },
    },
    create: {
      gameId: facts.gameId,
      organizationId: facts.organizationId,
      promptVersion: PROMPT_VERSION,
      sourceStatsHash: hash,
      sourceUpdatedAt,
      ...extra,
    },
    update: { sourceStatsHash: hash, sourceUpdatedAt, error: null, ...extra },
  });
}

// Loads the game from the PRIMARY (getGameById uses the primary client) so the
// recap can't miss the final round to replica lag. The LLM call does no DB read.
export async function generateGameSummary(gameId: string): Promise<void> {
  const game = (await getGameById(gameId)) as GameWithPlayersAndScores | null;
  if (!game) return;

  const facts = buildGameRecap(game);
  const hash = hashRecapFacts(facts);
  const sourceUpdatedAt = new Date();

  const existing = await prisma.gameSummary.findUnique({
    where: { gameId_promptVersion: { gameId, promptVersion: PROMPT_VERSION } },
  });
  if (existing?.status === "ready" && existing.sourceStatsHash === hash) return;

  if (
    facts.roundsPlayed < MIN_ROUNDS_FOR_SUMMARY ||
    facts.playerCount < MIN_PLAYERS_FOR_SUMMARY
  ) {
    await writeSummary(facts, hash, sourceUpdatedAt, { status: "insufficient_data" });
    return;
  }

  await writeSummary(facts, hash, sourceUpdatedAt, { status: "pending" });

  try {
    const { facts: pseudo, nameMap } = pseudonymizeRecap(facts);
    const { system, user } = buildSummaryPrompt(pseudo, DEFAULT_SUMMARY_OPTIONS);
    const { text, tokensUsed } = await generateSummaryText(system, user);

    const ungrounded = findUngroundedNumbers(text, pseudo);
    if (ungrounded.length) {
      console.warn(
        `[insights] ungrounded numbers in summary ${gameId}:`,
        ungrounded
      );
    }

    await writeSummary(facts, hash, sourceUpdatedAt, {
      status: "ready",
      content: rehydrateNames(text, nameMap),
      model: CLAUDE_SUMMARY_MODEL,
      tokensUsed,
    });
  } catch (err) {
    await prisma.gameSummary.update({
      where: { gameId_promptVersion: { gameId, promptVersion: PROMPT_VERSION } },
      data: {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        retryCount: { increment: 1 },
      },
    });
  }
}

// Durability: re-attempt summaries that never reached `ready`. Wire to a cron
// route in a later step; safe to call repeatedly (idempotent per game).
export async function regeneratePendingSummaries(limit = 20): Promise<number> {
  const stuck = await prisma.gameSummary.findMany({
    where: { status: { in: ["pending", "failed"] }, retryCount: { lt: 5 } },
    take: limit,
  });
  for (const s of stuck) await generateGameSummary(s.gameId);
  return stuck.length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/server/ai/__tests__/summary.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 5: Commit**

```bash
git add src/server/ai/summary.ts src/server/ai/__tests__/summary.test.ts
git commit -m "feat(insights): durable game-summary generation orchestration"
```

---

### Task 9: Trigger generation when a game finishes

**Files:**
- Modify: `src/server/mutations/games.ts` (`updateGameAsFinished`)
- Create: `src/server/__tests__/gameSummaryWiring.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/__tests__/gameSummaryWiring.test.ts`:

```ts
const authMock = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }));

const gameFindUnique = jest.fn();
const gameUpdate = jest.fn();
const userFindUnique = jest.fn();
jest.mock("@/server/db/db", () => ({
  __esModule: true,
  default: {
    game: { findUnique: (...a: unknown[]) => gameFindUnique(...a), update: (...a: unknown[]) => gameUpdate(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
  },
}));

jest.mock("@/app/posthog", () => ({ __esModule: true, default: () => ({ capture: jest.fn() }) }));

// after() runs its callback immediately in the test
jest.mock("next/server", () => ({ after: (cb: () => unknown) => cb() }));

const generateGameSummary = jest.fn().mockResolvedValue(undefined);
jest.mock("@/server/ai/summary", () => ({
  __esModule: true,
  generateGameSummary: (...a: unknown[]) => generateGameSummary(...a),
}));

// Email side effects are not under test
jest.mock("@/server/email", () => ({
  __esModule: true,
  sendGameCompleteEmail: jest.fn().mockResolvedValue(undefined),
  EMAIL_INTER_SEND_DELAY_MS: 0,
}));

import { updateGameAsFinished } from "@/server/mutations/games";

beforeEach(() => {
  authMock.mockReset(); gameFindUnique.mockReset(); gameUpdate.mockReset();
  userFindUnique.mockReset(); generateGameSummary.mockReset();
  authMock.mockReturnValue({ userId: "clerk_1", orgId: "org_1" });
  gameFindUnique.mockResolvedValue({
    id: "game_1", organizationId: "org_1", isFinished: false, players: [],
  });
  gameUpdate.mockResolvedValue({});
  userFindUnique.mockResolvedValue({ username: "Mike" });
  generateGameSummary.mockResolvedValue(undefined);
});

it("schedules summary generation for the finished game", async () => {
  await updateGameAsFinished("game_1", "u1", false);
  expect(generateGameSummary).toHaveBeenCalledWith("game_1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/__tests__/gameSummaryWiring.test.ts`
Expected: FAIL — `generateGameSummary` not called (wiring not added yet).

- [ ] **Step 3: Add the trigger**

In `src/server/mutations/games.ts`, add the import near the top (with the other imports):

```ts
import { generateGameSummary } from "@/server/ai/summary";
```

Then in `updateGameAsFinished`, immediately after the existing
`posthog.capture({ ... event: "update_game_as_finished" ... })` call and
**before** the existing `const registeredPlayers = ...` line, add an independent
durable trigger:

```ts
  // Generate the post-game recap durably after the response is sent. Reads the
  // game from the primary inside generateGameSummary, so no replica-lag risk.
  after(() => generateGameSummary(gameId));
```

(`after` is already imported from `next/server` in this file.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/server/__tests__/gameSummaryWiring.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/mutations/games.ts src/server/__tests__/gameSummaryWiring.test.ts
git commit -m "feat(insights): generate recap when a game finishes"
```

---

### Task 10: Read query + render the recap on the game page

**Files:**
- Create: `src/server/queries/insights.ts`
- Modify: `src/server/queries/index.ts` (re-export)
- Create: `src/components/insights/GameSummaryCard.tsx`
- Create: `src/components/__tests__/insights/GameSummaryCard.test.tsx`
- Modify: `src/app/games/[id]/page.tsx`

- [ ] **Step 1: Write the failing component test**

Create `src/components/__tests__/insights/GameSummaryCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { GameSummaryCard } from "@/components/insights/GameSummaryCard";

describe("GameSummaryCard", () => {
  it("renders the recap content when ready", () => {
    render(<GameSummaryCard status="ready" content="Mike edged Sarah." />);
    expect(screen.getByText("Mike edged Sarah.")).toBeInTheDocument();
  });

  it("shows a pending message while generating", () => {
    render(<GameSummaryCard status="pending" content={null} />);
    expect(screen.getByText(/being written/i)).toBeInTheDocument();
  });

  it("shows the insufficient-data message", () => {
    render(<GameSummaryCard status="insufficient_data" content={null} />);
    expect(screen.getByText(/not enough rounds/i)).toBeInTheDocument();
  });

  it("renders nothing on failure", () => {
    const { container } = render(
      <GameSummaryCard status="failed" content={null} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/insights/GameSummaryCard.test.tsx`
Expected: FAIL — cannot find module `@/components/insights/GameSummaryCard`.

- [ ] **Step 3: Write the component**

Create `src/components/insights/GameSummaryCard.tsx`:

```tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function GameSummaryCard({
  status,
  content,
}: {
  status: string;
  content: string | null;
}) {
  if (status === "failed") return null;

  return (
    <Card className="max-w-2xl mx-auto mt-4">
      <CardHeader>
        <CardTitle>Game Recap</CardTitle>
      </CardHeader>
      <CardContent>
        {status === "ready" && content ? (
          <p>{content}</p>
        ) : status === "insufficient_data" ? (
          <p className="text-muted-foreground">
            Not enough rounds for a recap.
          </p>
        ) : (
          <p className="text-muted-foreground">Your recap is being written…</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run component test to verify it passes**

Run: `npm test -- src/components/__tests__/insights/GameSummaryCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the read query**

Create `src/server/queries/insights.ts`:

```ts
import "server-only";

import prismaReadonly from "@/server/db/db-readonly";
import { PROMPT_VERSION } from "@/lib/insights/summaryPrompt";

// Reads from the replica — the summary row is a cache; if it hasn't replicated
// yet the page shows the pending state and the user can refresh.
export async function getGameSummary(gameId: string) {
  return prismaReadonly.gameSummary.findUnique({
    where: { gameId_promptVersion: { gameId, promptVersion: PROMPT_VERSION } },
  });
}
```

- [ ] **Step 6: Re-export from the queries barrel**

In `src/server/queries/index.ts`, add:

```ts
export { getGameSummary } from "./insights";
```

- [ ] **Step 7: Mount the card on the game page**

In `src/app/games/[id]/page.tsx`:

Add imports at the top:

```ts
import { getGameSummary } from "@/server/queries/insights";
import { GameSummaryCard } from "@/components/insights/GameSummaryCard";
```

Change the parallel load to also fetch the summary:

```ts
  const [gameData, { userId, orgId }, summary] = await Promise.all([
    getGameById(params.id),
    auth(),
    getGameSummary(params.id),
  ]);
```

Then, inside the returned JSX, render the card after `</ScoringShell>` but before
`</section>`, only when the game is finished:

```tsx
      {isFinished && summary && (
        <GameSummaryCard status={summary.status} content={summary.content} />
      )}
```

- [ ] **Step 8: Typecheck + full test run**

Run: `npm run typecheck && npm test`
Expected: typecheck PASS; all tests green.

- [ ] **Step 9: Commit**

```bash
git add src/server/queries/insights.ts src/server/queries/index.ts \
  src/components/insights/GameSummaryCard.tsx \
  src/components/__tests__/insights/GameSummaryCard.test.tsx \
  src/app/games/[id]/page.tsx
git commit -m "feat(insights): show game recap on the game page"
```

---

### Task 11: End-to-end manual verification

**Files:** none (manual)

- [ ] **Step 1: Confirm the env key is set**

Ensure `ANTHROPIC_API_KEY` is present in `.env`.

- [ ] **Step 2: Run the app and finish a game**

Run: `npm run dev`
Then: create a game with 2 players, play ≥2 rounds to the threshold, and finish it.
Expected: the game page shows "Game Recap" — first the pending state, then (after refresh) a warm neutral paragraph naming the real winner with grounded numbers, no "you".

- [ ] **Step 3: Confirm the row + idempotency**

Run: `npx prisma studio`
Expected: a `GameSummary` row for that game with `status = ready`, populated `content`, `model = claude-opus-4-8`, a non-null `sourceStatsHash`. Finishing the same game again does not duplicate the row.

- [ ] **Step 4: Merge the phase branch into the integration branch**

```bash
git checkout feature/llm-insights
git merge --no-ff feature/llm-insights-p1-summary -m "Merge Phase 1: post-game summary (M0a + M1)"
```

---

## Self-Review

**Spec coverage (Phase-1 slice of `docs/superpowers/specs/2026-06-13-llm-insights-design.md`):**
- M0a Claude foundation → Tasks 1–2 (SDK + client + `GameSummary` table). The generic `InsightJob` table is intentionally deferred (scope note in header); durability is met via `GameSummary` status + `regeneratePendingSummaries`.
- Fact snapshot from primary (spec §8, rev #3) → Task 8 loads via `getGameById` (primary).
- Durable, not fire-and-forget (rev #4) → Task 8 status machine + Task 9 `after()` + sweep.
- Status + invalidation fields (rev #5) → Task 2 model (`status`, `error`, `retryCount`, `sourceStatsHash`, `sourceUpdatedAt`).
- Neutral, no-audience MVP (rev #6) → Task 6 prompt forbids "you"; `audienceUserId` null.
- Pseudonymized names (rev #21) → Task 5 + Task 8.
- Fact-grounding / eval seed (rev #22) → Task 7.
- Failure UX (rev #23) → Task 10 card states (pending/failed/insufficient).
- Single formula source (rev #16) → recap reuses `calculateRoundScore` / `calcGameStats`, no re-inlined formula.
- Pinned Claude params (rev #19) → Task 1 (`thinking: adaptive`, `effort: low`, no sampling params).
- Not in this phase (correctly deferred to M0b/M2/M3/M4): RLS, `getInsightScope`, views, chat, metric-plan DSL, tiles.

**Placeholder scan:** none — every code step contains complete code; no TBD/TODO.

**Type consistency:** `GameRecapFacts`, `RecapStanding`, `Pseudonymized`, `SummaryOptions`, `PROMPT_VERSION`, `CLAUDE_SUMMARY_MODEL`, `generateSummaryText`, `generateGameSummary`, `getGameSummary`, and the `gameId_promptVersion` unique selector are used identically across tasks. `buildGameRecap`/`generateGameSummary` both take `GameWithPlayersAndScores`. The card props (`status`, `content`) match `getGameSummary`'s row shape.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-13-llm-insights-phase1-summary.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with batch checkpoints.

Which approach?

---

## Codex Review Revisions (applied 2026-06-13)

Codex reviewed this plan against the codebase: 3 blockers + 9 should-fix + 2 nice-to-have, all accepted. The changes below **override the task bodies above where they conflict** — the implementation follows these.

### Durability & triggers (blockers #1, #2, #3)

`after()` is post-response best-effort, not a queue, and the original plan created the `GameSummary` row *inside* the async callback — so a dropped `after()` left nothing for the sweep to retry. Also, this app lets users **edit finished games** (`src/server/mutations/rounds.ts:167`), and that path never called the trigger.

- **Split generation into a synchronous enqueue + an async run** in `src/server/ai/summary.ts`:
  - `enqueueGameSummary(gameId): Promise<{ enqueued: boolean }>` — runs **in-request** (primary DB). Loads the game via `getGameById` (primary), builds facts, hashes. Writes nothing and returns `{enqueued:false}` if there's no game or an existing `ready` row already matches the hash; upserts `insufficient_data` (returns false) for `<2` rounds / `<2` players; otherwise upserts a `pending` row with the new hash and returns `{enqueued:true}`. A durable row therefore exists before the response returns.
  - `runGameSummary(gameId): Promise<void>` — the LLM call; idempotent (re-checks `ready`+hash); writes `ready` or `failed` (+`retryCount`).
  - `scheduleGameSummary(gameId): Promise<void>` — `if (!(await isLlmFeaturesEnabled())) return; const { enqueued } = await enqueueGameSummary(gameId); if (enqueued) after(() => runGameSummary(gameId));`
  - `regeneratePendingSummaries(limit=20)` — sweeps `pending`/`failed` (retryCount<5) → `runGameSummary`.
- **Trigger from both finish paths:** `updateGameAsFinished` calls `await scheduleGameSummary(gameId)` (covers the direct "Finish" button and the finalize-via-score-write branch, which routes through `updateGameAsFinished`). ADD a trailing `await scheduleGameSummary(gameId)` at the end of `syncGameCompletionAfterScoreWrite` in `rounds.ts` so edits that keep a game finished regenerate when the hash changes (hash-gating ⇒ no-op when nothing changed; a reopened game falls out because the page renders only when finished). This replaces Task 9's single `after(() => generateGameSummary(...))`.
- **Sweep route:** add `src/app/api/insights/sweep/route.ts` (GET, guarded by a `CRON_SECRET` request header) calling `regeneratePendingSummaries()`. Vercel cron schedule + `CRON_SECRET` env = human step.
- **Read status from primary:** `getGameSummary` reads from `@/server/db/db` (primary; one indexed row) to dodge replica lag on a just-finished game, and the page renders the pending state when `isFinished && !summary`.
- **Flag-gated:** `scheduleGameSummary` early-returns unless `isLlmFeaturesEnabled()`; the page only renders the card when the flag is on. Phase 1 ships dark.

### Recap correctness (#5, #6, #7, #8) — build in pseudonym-ready, playerKey space

`buildGameRecap(game)` now returns `{ facts: GameRecapFacts; playerNames: Record<playerKey, realName> }`:
- Feeds `calcGameStats` an **identity** name map (`{key: key}`) so `biggestRound`/`worstRound` carry the **playerKey**, not a display name.
- `GameRecapFacts` identifiers are all `playerKey`; it contains **no real names and no raw score arrays** — only aggregates — so the hash is order-stable.
- `standings` sorted by **(isWinner first, total desc, playerKey asc)** ⇒ `standings[0]` is the real winner even under the final-round blitz-pile tiebreak; `rank` follows that order. `winnerKey` replaces `winnerName`.
- `blitzLeader` ties broken by lowest `playerKey` (deterministic).
- `pseudonymizeRecap(facts, playerNames)` assigns `keyToPseudo` ("Player A/B"…) by standings order, replaces every `playerKey` in the facts with its pseudonym, and returns `{ promptFacts, nameMap: { "Player A": realName } }`. Real names never enter `calcGameStats` or the prompt; internal UUIDs never reach the LLM; duplicate guest names no longer collapse (keyed by playerKey). `rehydrateNames(text, nameMap)` maps pseudonym→real for storage.
- `hashRecapFacts` hashes `facts` (no timestamps). `sourceUpdatedAt` is computed separately (below), not hashed.

### Claude client (#9, #10, #11)

- Use `satisfies Anthropic.MessageCreateParamsNonStreaming` (Codex confirmed the installed SDK 0.104.x types support `claude-opus-4-8`, `thinking:{type:"adaptive"}`, `output_config.effort`); fall back to a typed cast only if `tsc` rejects it.
- `generateSummaryText` **throws** when the text is empty or `res.stop_reason === "refusal"` ⇒ the row becomes `failed`, never `ready` with empty content.
- `tokensUsed = input_tokens + output_tokens + (cache_creation_input_tokens ?? 0) + (cache_read_input_tokens ?? 0)`.
- `sourceUpdatedAt` = `max(score.updatedAt across loaded rounds)`, falling back to `game.endedAt ?? new Date()` — computed in the orchestration from the loaded game, **not** `new Date()`.

### Tests (#12)

- Add `jest.mock("@/server/ai/summary", () => ({ scheduleGameSummary: jest.fn() }))` to `src/server/__tests__/mutations.test.ts` so existing finalization tests don't run real summary work. The Task 9 wiring test asserts `scheduleGameSummary` was called.

### Kept as-is (#13)

- `@updatedAt` on `GameSummary` is intentional (status-machine timing); it knowingly diverges from the repo's manual `updated_at` convention.
