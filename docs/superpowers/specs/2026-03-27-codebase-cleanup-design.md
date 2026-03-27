# Codebase Cleanup & Tech Debt Reduction

**Date:** 2026-03-27
**Goal:** Clean up the codebase for maintainability, testability, and readiness for agentic engineering workflows.

## Section 1: Dead Code Removal

Delete files and exports that nothing references:

- **Delete** `src/server/test-gameplayers.js` — manual test script, zero imports, CommonJS syntax
- **Delete** `src/components/FeatureFlagExample.tsx` — demo component, zero imports, references removed flag
- **Remove** `isScoreChartsEnabled()` from `src/featureFlags.ts`
- **Remove** `useScoreChartsFlag()` from `src/hooks/useFeatureFlag.ts`

## Section 2: AI Tools Consolidation

Merge `manualTools.ts` Zod validation patterns into `tools.ts`, then delete `manualTools.ts`.

- Port the 6 tool definitions in `tools.ts` from `jsonSchema()` to Zod schemas
- Keep the `createAnalyticsTools()` export interface unchanged — chat route stays the same
- Keep `runWithTracing()` helper and PostHog telemetry from `tools.ts`
- Delete `manualTools.ts` (keep `src/server/ai/utils.ts` — it's used by `enhancedSystemPrompt.ts` which the chat route imports)
- Remove `@opentelemetry/exporter-trace-otlp-http` from dependencies (only needed as transitive dep of `@posthog/ai`, no direct imports)

**Result:** One file, Zod validation, tracing, ~300 lines (down from 745 combined).

## Section 3: Split queries.ts by Domain

Mirror the mutations structure:

```
src/server/queries/
├── games.ts      — getGames(), getGameById()
├── friends.ts    — getFriends(), getFriendsForNewGame(), getIncomingFriendRequests(), getOutgoingPendingFriendRequests()
├── users.ts      — getFilteredUsers()
├── stats.ts      — getPlayerBattingAverage(), getHighestAndLowestScore(), getCumulativeScore(), getPlayerStats()
└── index.ts      — barrel re-export
```

- Existing `queries.ts` becomes a barrel re-export for backward compatibility
- Each file gets `import "server-only"`
- `stats.ts` fixes the N+1 in `getHighestAndLowestScore()` — combine separate MAX/MIN queries into one
- Each file imports its own dependencies

## Section 4: Split scoreDisplay.tsx

Break the 400-line component into two focused components:

**`ScoreDisplay.tsx`** (read-only):
- Renders score table, cumulative scores, score line graph
- Typed props, no `any`
- Pure presentation, no edit state

**`ScoreEditor.tsx`** (edit mode):
- Manages edit state with proper types (replacing `any[]` useState)
- Handles validation, save, cancel
- Uses shared types with ScoreDisplay

**`scoreTypes.ts`** (shared types):
- Interfaces used by both components

**Parent component** decides which to render based on edit mode state. Toggle logic stays with parent.

Cleanup included:
- Remove `console.log` debug statements
- Replace all `any` types with proper score/player types
- Validation logic references `gameRules.ts` constants

## Section 5: Type Safety & Code Hygiene

**Fix `any` types:**
- `src/server/email.ts:14` — type the `react` parameter properly
- `src/app/api/slack/whois/route.ts:144` — type `stats` with actual shape

**Extract magic numbers:**
- Email retry config (`maxAttempts`, `baseDelay`, inter-email delay) to named constants in `email.ts`
- AI tool limits (`maximum: 50`, `maximum: 365`) to constants in `tools.ts`

**Remove debug artifacts:**
- Verify no stray `console.log` calls in non-error paths

**Fix placeholder API key check:**
- `src/app/api/chat/route.ts:40` — replace `"sk-your-openai-api-key"` string check with `!process.env.OPENAI_API_KEY` truthy check

## Section 6: GitHub Issues for Deferred Work

Create issues after code changes are merged:

1. Tailwind CSS 3 to 4 migration
2. Add component tests with React Testing Library (scoreEntry, scoreDisplay, newGameChooser)
3. Refactor newGameChooser.tsx state management (useReducer or state machine)
4. Feature flag caching strategy (currently no caching on PostHog calls)
5. Route-level auth middleware consolidation (replace per-route checks)
6. Add AI tool test coverage (zero tests on complex SQL and business logic)

## Out of Scope

- Tailwind 4 migration
- Writing new test suites (improving testability but not adding tests)
- newGameChooser.tsx state refactor
- Feature flag caching
- Route-level auth middleware
- Component tests with React Testing Library
