# Design: LLM-Driven Insights for Blitzer

**Date:** 2026-06-13
**Status:** Draft for review
**Author:** Product/data design session (Claude Code)

Companion-app feature that lets Dutch Blitz players ask natural-language questions
about their gameplay, get auto-generated dashboard stat tiles, and receive a
tailored narrative recap after each game — all grounded in real Postgres data,
never hallucinated numbers.

This spec incorporates an external design review (Codex, gpt-5.5) that checked
live Neon / PgBouncer / Postgres-RLS / Anthropic docs; the load-bearing
corrections from that review are folded in below and flagged `[rev]`.

---

## Locked decisions

| Area | Decision |
|---|---|
| Engine | **Claude API + tool use** — official `@anthropic-ai/sdk`, Messages API tool runner, `claude-opus-4-8`, streamed from the Next.js backend. Not the Claude Agent SDK / Managed Agents (containers) — overkill for read-only Postgres Q&A. |
| Reuse stance | **Re-platform, not rewrite** — keep the data/query layer + tool implementations + scoring helpers; replace only the OpenAI/Vercel-AI-SDK orchestration and the `useChat` transport. |
| MVP wedge | **Post-game narrative summary first.** |
| Query engine | **Curated typed tools + a structured metric-plan DSL** for the nuanced long tail. Raw LLM-written SQL stays behind a separate flag + security suite, post-MVP. `[rev]` |
| Data scope | **Circle-scoped** — a user may query any player they've shared games with, across their circles, plus their own legacy (null-org) games. |
| Tiles | **Deterministic first**, LLM blurbs layered on later (on-demand, stale-while-revalidate per viewer). `[rev]` |

---

## 1. Objectives & success criteria

**Objective.** A player can (a) ask how they and their circle play, (b) see
auto-generated stat tiles, and (c) read a narrative recap after each game —
grounded in Postgres, with every cited number traceable to a tool/DSL result.

**Success criteria (measurable):**

- **Accuracy** — ≥95% on a labeled, **fact-based** eval set (~40 questions). The grader checks that *every numeric claim maps to a tool/DSL result*, not prose similarity. `[rev #22]`
- **Isolation** — 0 cross-circle leakage across an adversarial security suite (revoked membership, cross-circle probes, SQL/prompt injection).
- **Summary coverage** — recap reaches a terminal state (`ready`/`failed`) for ≥95% of finished games; p95 generation < ~30s end-to-end (durable job, not request-bound). `[rev #4]`
- **Latency** — chat **first SSE status event** < 1s; **first NL token** target p50 < 6s (re-baselined for adaptive thinking + ≥1 DB tool call). `[rev #18]`
- **Dashboard** — TTFB unchanged: tiles render from deterministic queries; LLM blurbs hydrate async and never block paint. `[rev #24]`
- **Cost** — within a per-interaction budget (track `cache_read_input_tokens` / `cache_creation_input_tokens` per call). `[rev #19]`
- **Engagement** — PostHog: insights opened, questions/session, summary views, tile interactions.

## 2. Scope, MVP & reuse verdict

In scope: **post-game summary** (wedge), **chat**, **dashboard tiles**. Out of
scope for MVP: persistent multi-session chat memory, raw LLM-written SQL,
cross-circle/global leaderboards, voice, push.

**Reuse verdict (re-platform).**
*Keep* — the read-only query layer (`src/server/queries/stats.ts`,
`src/server/db/db-readonly.ts`), the canonical `ROUND_SCORE_SQL`, the 6 tool
*implementations* (`src/server/ai/tools.ts`), the scoring helpers
(`src/lib/scoring/gameStats.ts`, `probability.ts`), the `llm-features` flag,
`src/proxy.ts` route protection, the `BasicStatBlock` UI.
*Replace* — the OpenAI/Vercel-AI-SDK orchestration in `src/app/api/chat/route.ts`
and the `useChat` client transport in `src/app/insights/ModernChatUI.tsx`.
Rationale: the data layer and tool bodies are already clean, provider-agnostic
and tested; only the LLM glue (weak model, OpenAI, chat-only) is dated.

## 3. Architecture & data flow

```
                        ┌─────────────────────────── Next.js backend ───────────────────────────┐
Browser                 │                                                                          │
 ├─ Dashboard (RSC) ─────┼─▶ deterministic tile queries (replica) ──▶ paint immediately            │
 │   BasicStatBlock      │        └▶ InsightTile cache (primary)  ◀── on-demand SWR blurb job        │
 │                       │                                            (Claude/Haiku, per viewer)     │
 ├─ Game detail (RSC) ───┼─▶ getGameSummary(gameId) ─▶ GameSummary (primary) ◀─ durable summary job ─┤
 │                       │        recap FACTS snapshotted from PRIMARY at game finish ───────────────┤
 └─ /insights chat ─SSE──┼─▶ /api/insights/chat ─▶ Claude tool loop (Opus 4.8, streaming)            │
                         │        ├─ curated typed tools ─┐                                          │
                         │        └─ metric_plan tool ────┤ server compiles → safe SQL               │
                         │                                ▼                                          │
                         │   getInsightScope(userId) → AuthorizedScope ─▶ READ REPLICA (analytical)  │
                         │                                  ▲ RLS + read-only role + llm_views schema │
                         └──────────────────────────────────┴───────────────────────────────────────┘
   Reads → replica.  Writes (GameSummary, InsightTile, jobs) → primary.  [rev #2]
```

Key correction `[rev #2]`: analytical **reads** use the replica; cache/job/summary
**writes** use the primary. The earlier "all DB access via replica" was wrong.

## 4. Scope & identity model `[rev #7,#8,#9]`

**`getInsightScope(userId) → AuthorizedScope`** returns an explicit object, not
just org ids:

```ts
type PlayerKey = { kind: "user" | "guest"; id: string }   // never merge guests by name
type AuthorizedScope = {
  callerPlayerKeys: PlayerKey[]      // the caller's own user + any guest identities
  orgIds: string[]                    // circles the caller is a member of (OrganizationMembership)
  legacyGameIds: string[]             // null-org games the caller PARTICIPATED in (separate auth path)
  scopeHash: string                   // stable hash of sorted (orgIds ∪ legacyGameIds) — for cache keys
}
```

- **Circle games**: visibility follows the existing app model — any member of a
  circle can already see all of that circle's games (`getGames` filters by
  `auth().orgId`). So org membership legitimately grants circle-wide visibility.
- **Legacy null-org games** are a *separate* authorization path `[rev #8]`:
  `organizationId IS NULL` can't be expressed as an org filter, and you may only
  see legacy games you personally played in — never another player's null-org
  history just because their `userId` appears in a query.
- **Player identity** is a typed `PlayerKey` everywhere (tools, views, DSL).
  Guests are never merged by display name. Tools that can return guest stats are
  named player-oriented (`getPlayerOverview`, not `getUserOverview`). `[rev #9]`

## 5. Data model

Three additive tables; **no change to the gameplay schema**.

**`GameSummary`** `[rev #5,#6]`

| field | notes |
|---|---|
| `id`, `gameId`, `organizationId` | |
| `audienceUserId` | **null for MVP** (neutral recap); set only for future personalized recaps `[rev #6]` |
| `status` | `pending` \| `ready` \| `failed` \| `insufficient_data` |
| `content`, `model`, `promptVersion` | |
| `sourceStatsHash`, `sourceUpdatedAt` | invalidation: regenerate/mark stale if scores change post-finish |
| `tokensUsed`, `error`, `retryCount`, `createdAt`, `updatedAt` | |

Unique index on `(gameId, audienceUserId, promptVersion, sourceStatsHash)` →
idempotent generation. For the neutral MVP, `audienceUserId` is null and
"you-centric" language is forbidden in the prompt so one player's recap can't
leak personal framing to another. `[rev #6]`

**`InsightTile`** `[rev #10]`

| field | notes |
|---|---|
| `scopeType` (`user`\|`org`), `scopeSubjectId`, `scopeHash` | from sorted authorized ids — not a weak `userId\|orgId` string |
| `tileKey`, `tileVersion`, `promptVersion` | |
| `statPayload` jsonb (deterministic), `blurb` (LLM, nullable), `computedAt`, `expiresAt` | |

**Authorization is re-checked on *read*** so a tile cached under a prior
membership can't leak after the viewer is removed from a circle. `[rev #10]`

**`InsightJob`** (durable async) `[rev #4]` — `{id, kind, refId, idempotencyKey,
status, attempts, lastError, runAfter}`. Idempotency key e.g.
`game_summary:{gameId}:{promptVersion}:{sourceHash}`.

**`InsightMessage`** — optional, post-MVP (chat history).

**Single source for the score formula** `[rev #16]`: curated tools, the
read-only views, and the DSL compiler all derive the round score from one place
(`ROUND_SCORE_SQL`). A parity test asserts the SQL view formula equals the
TypeScript helper formula so they can't drift.

**Read-only views** live in a dedicated `llm_views` schema, e.g.
`v_player_round_scores(player_kind, player_id, player_name, organization_id,
game_id, round_no, score, blitz_pile_remaining, total_cards_played, played_at)`
and `v_game_results(...)`. Both curated tools and the DSL compile against these
views — not raw tables. `[rev #16]`

**Indexing** `[rev #17]`: existing indexes (`Score.userId/guestId/roundId`,
`Round.gameId`, `Game.organizationId`) cover curated aggregations. The new hot
path is cross-player-per-circle aggregation (`Score → Round → Game.organizationId
→ player`). Capture `EXPLAIN ANALYZE` fixtures on representative data **before
launching chat**; be ready to add a composite covering index or a
`player_round_scores` materialized/read model keyed by
`(organizationId, gameId, playerKind, playerId, playedAt)`.

## 6. Query engine — curated tools + metric-plan DSL

**Tier 1 — curated typed tools** (port existing 6 + circle-scope):
`getPlayerOverview`, `getRecentGames`, `getExtremes`, `getCumulativeScore`,
`getTrends`, `getHeadToHead` (generalize `getOpponentStats`),
`getCircleLeaderboard`. Zod tools via the SDK tool runner; each returns exact
numbers. Tool descriptions are **prescriptive about *when* to call** (Opus 4.8
under-reaches for tools by default).

**Tier 2 — `metric_plan` tool (the nuanced long tail)** `[rev #15]`. Instead of
the LLM writing SQL, it emits a **structured plan** the server compiles into
safe, parameterized SQL:

```ts
type MetricPlan = {
  subject: PlayerKey | { allInScope: true }
  metric: "round_score" | "blitz_rate" | "win_rate" | "cards_played" | ...
  filters?: { gameLengthRounds?: Range; dateRange?: Range; opponent?: PlayerKey; ... }
  groupBy?: ("player" | "game" | "week" | "month")[]
  orderBy?: ...; limit?: number
}
```

The compiler validates against an allow-list of metrics/dimensions, always
applies scope, and produces a single parameterized `SELECT`. This is far smaller
an attack surface than free SQL and is unit-testable. **Raw LLM-written SQL is
deferred** behind its own flag + the full hardening below, only if the DSL proves
too limiting. `[rev #15]`

**Isolation & execution (applies to DSL-compiled and any future raw SQL)** —
defense in depth:

1. **Postgres RLS as the real boundary** `[rev #11]`. Policies on the base tables
   (or `security_invoker`/`security_barrier` views in `llm_views`). The read role
   is a **dedicated, non-owner, non-`BYPASSRLS`** role; `FORCE ROW LEVEL SECURITY`
   on base tables; grants only on `llm_views`. Table owners and `BYPASSRLS` would
   otherwise silently bypass policies.
2. **Scope set inside one explicit transaction** `[rev #12]`. Neon's pooled
   endpoint is PgBouncer **transaction-pooled**, so session state doesn't persist.
   Per request: `prisma.$transaction(tx => { tx.$executeRaw(select set_config('app.org_ids_json', $1, true)); ...query... })` on the **same** connection, then commit/rollback. Never a bare session `SET`.
3. **Parameterized scope** `[rev #13]`. Pass scope as a JSON param to
   `set_config(...)`; a stable DB function parses it with **default-deny** when
   unset. No hand-built `'{...}'` array literals.
4. **Statement hardening** `[rev #14]` (for the raw-SQL path; mostly N/A to the
   compiled DSL): AST parse; single `SELECT`; ban `WITH RECURSIVE`, `FOR UPDATE`,
   `pg_sleep`, comments/semicolons, system schemas, volatile/unknown functions,
   excessive joins. Enforce `statement_timeout`, row limit, byte limit, max
   tool-calls per turn; log every rejection with a reason.
5. **Replica only** — never the primary.

## 7. Prompting

- **System prompt split for prompt caching** `[rev #19]`: Block 1 (stable,
  `cache_control: {type:"ephemeral"}`) = Dutch Blitz rules + scoring formula +
  tool/DSL catalog + data dictionary + output guardrails ("only cite numbers
  returned by tools; never invent stats"). Block 2 (volatile, after the
  breakpoint) = caller scope, a small stat snapshot, the question. Verify the
  stable prefix clears the model's minimum-cacheable threshold and stays
  byte-identical; track cache token usage per call.
- **Pseudonymize player names before the LLM sees them** `[rev #21]`. Send
  `Player A / Player B` + structured stats; substitute real display names
  server-side *after* generation. This neutralizes name-based prompt injection
  *and* keeps display names (potential PII) out of the provider + out of
  PostHog/Sentry traces. Chat resolves a user-typed name → `PlayerKey` server-side
  first, then pseudonymizes tool outputs.
- **Model/params** `[rev #19]`: `claude-opus-4-8`; `thinking: {type:"adaptive"}`;
  explicit `output_config: {effort:"medium"}` (sweep later); streaming; **no**
  sampling params (`temperature`/`top_p`/`top_k` 400 on Opus 4.8). Consider
  `claude-haiku-4-5` and/or Message Batches for high-volume cheap copy (tile
  blurbs) `[rev #20]`.

## 8. Post-game summary (MVP wedge)

- **Fact snapshot at finish, from the primary** `[rev #3]`. On
  `updateGameAsFinished`, synchronously build a `GameRecapFacts` payload from the
  primary (we already hold the data in the write path) via a pure
  `buildGameRecap(game)` over existing helpers: `{finalStandings, winner,
  tiebreakUsed, perRoundDeltas, blitzCounts, roundWinners, biggestRound,
  worstRound, leadChanges}`. Persist the facts. The LLM call then formats facts
  with **no DB read** — sidestepping replica lag entirely.
- **Durable generation** `[rev #4]`. Enqueue an `InsightJob` (not a
  fire-and-forget Promise, which serverless can kill). A retryable worker/cron
  drains it; idempotency key prevents dupes; `status` transitions
  `pending → ready|failed|insufficient_data`.
- **Tunable parameters** (system-prompt vars, for later personalization):
  perspective (neutral / you-centric), tone (hype / dry / wholesome), length
  (one-liner / paragraph / play-by-play), spotlight (winner / most-improved /
  biggest-blunder). **MVP ships one neutral, warm, ~paragraph default**; no
  `audienceUserId`, no "you" framing. `[rev #6]`

## 9. Dashboard tiles — deterministic first `[rev #24,#20]`

- **Phase A — deterministic tiles.** Reuse `BasicStatBlock`. Compute the number
  from the query layer; render immediately. Tiles: blitz-rate trend, nemesis,
  signature round, consistency. No LLM in the paint path.
- **Phase B — LLM blurbs (later).** Layer a one-line read onto each tile. The
  **number stays computed; the LLM only writes prose** (can't hallucinate a
  stat). Generation is **on-demand, stale-while-revalidate per viewer** — serve
  the cached blurb (or none) immediately, revalidate in the background on first
  view after `expiresAt`. No daily batch for every active user (most never open
  the dashboard). `[rev #20]` Plus a "coach's tip" tile in Phase B.

## 10. Privacy, safety & failure UX `[rev #23]`

- **Failure UX.** Game detail tolerates `summary pending` (skeleton),
  `summary failed` (quiet retry/hide), `insufficient_data` (friendly note). Chat
  handles Anthropic errors, timeout, abort, "no visible games," and partial tool
  failure — never leaking stack traces, raw prompts, or other circles' data.
- **PostHog/Sentry**: no PII in event properties (per CLAUDE.md); `@posthog/ai`
  Anthropic tracing in redaction/privacy mode; pseudonymized names mean traces
  carry `Player A/B`, not real names.
- **Rate limiting**: per-user limits on chat + the metric_plan tool; cap tool
  calls per turn.

## 11. Milestones

- **M0a — Claude foundation** `[rev #1]`: add `@anthropic-ai/sdk` +
  `ANTHROPIC_API_KEY`, a `claudeClient`, `GameSummary` + `InsightJob` tables, the
  durable-job worker, the fact-based eval harness skeleton. *Gate:* a Claude call
  round-trips; eval harness runs.
- **M0b — Data substrate**: `getInsightScope` (explicit `AuthorizedScope` incl.
  legacy path), `llm_views` schema + views, dedicated read-only role + RLS +
  `set_config` scope function, `EXPLAIN ANALYZE` fixtures. *Gate:* RLS isolation
  test passes (a wrong scope returns 0 rows); leaderboard plan is acceptable.
- **M1 — Post-game summary (wedge)**: `buildGameRecap` (pure, unit-tested) →
  fact snapshot at finish → durable job → single Claude format call →
  `GameSummary` → game-detail render with pending/failed/insufficient states.
  *Gate:* ≥95% reach terminal state; reads well on a labeled set; idempotent.
- **M2 — Chat on Claude**: new `/api/insights/chat` (tool runner, streaming) +
  port the curated tools with circle-scope + new SSE client transport replacing
  `useChat`; behind `llm-features`. *Gate:* fact-based eval accuracy; first-status
  <1s and first-token latency target; security suite = no leakage.
- **M3 — Metric-plan DSL**: `metric_plan` tool + server compiler + RLS-backed
  execution; added to chat. *Gate:* answers nuanced eval questions the curated
  tools miss; isolation + timeout/limit tests pass. (Raw guarded SQL: separate
  later flag, only if needed.)
- **M4a — Deterministic tiles**; **M4b — LLM blurbs (SWR)**. *Gate:* dashboard
  TTFB unchanged; blurbs match computed stats; cost within budget.

**Order:** M0a → M0b → M1 → M2 → M3; M4a can start after M0b; M4b after M2.
Cross-cutting throughout: PostHog tracing, rate limits, cost dashboard, eval set.

## 12. Trade-offs & risks

| Risk | Mitigation |
|---|---|
| Hallucinated numbers | Tools/DSL return exact values; tiles compute the number, LLM writes only prose; system rule forbids inventing stats; fact-based eval enforces it |
| Cross-tenant read | RLS (non-owner role, FORCE RLS) + per-txn parameterized scope + DSL allow-list + replica-only (`[rev #11–14]`) |
| Replica lag corrupting recaps | Snapshot facts from primary at finish; LLM call does no DB read (`[rev #3]`) |
| Lost async generation | Durable `InsightJob` + retries + idempotency, not fire-and-forget (`[rev #4]`) |
| Stale tile leaks after removal | Re-check authorization on tile read; `scopeHash` keying (`[rev #10]`) |
| Cost/latency | Prompt caching, fact-snapshot (no tool loop for summaries), SWR tiles, Haiku/Batches for cheap copy |
| Guest / dual identity | Typed `PlayerKey`; never merge guests by name (`[rev #9]`) |
| Legacy null-org games | Separate participation-based auth path (`[rev #8]`) |
| Formula drift | Single `ROUND_SCORE_SQL` source + view↔helper parity test (`[rev #16]`) |
| PII / name injection | Pseudonymize before the LLM; substitute server-side (`[rev #21]`) |

## 13. Open questions

1. **Summary delivery** — game-detail page only for MVP, or also a finish-time toast/notification? (Assumed: game-detail only.)
2. **Cost ceiling** — target $/summary and $/chat, to tune model choice (Opus vs Haiku) and caching aggressiveness?
3. **Tile TTL** — what `expiresAt` window for the SWR blurbs (e.g. 24h)?
4. **Eval ownership** — who curates/labels the ~40-question eval set and the adversarial isolation cases?
