# Scoring Revamp Plan 5: Cleanup & Gaps — Identified Items

> These items were collected during Plan 4 implementation and code review. This is a starting point for brainstorming/planning, not a final plan.

## Legacy UI Removal (when flag is on)

- **Remove ScoreDisplay + ScoreLineGraph from game page** — still rendered alongside ScoringShell when `scoring-revamp` flag is enabled. The old score table and graph double up with the new UI.
- **Remove old GameOver component** — `src/app/games/[id]/GameOver.tsx` is dead code (import removed in Plan 4).
- **Remove old ScoreEntry/ScoreEditor** — `src/app/games/[id]/scoreEntry.tsx` and `ScoreEditor.tsx` are only used in the non-revamp path. When flag is on, they're unused.

## Code Duplication (from Plan 4 review)

- **Extract shared `findPlayerScore` utility** — identical function in `BetweenRoundsView.tsx:36` and `ScoringShell.tsx` (gameOver branch). Move to `src/components/scoring/utils.ts` or similar.
- **Extract shared round editing hook** — `handleEditRound`, `handleSaveEdit`, editing state management duplicated between `BetweenRoundsView` and `ScoringShell`. Extract `useRoundEditing(gameId, rounds, players)` hook.
- **Extract shared tie-breaking function** — logic duplicated in `src/lib/gameLogic.ts:determineWinner` and `src/server/mutations/rounds.ts` (winner-update-after-edit). Create a pure `breakTie(playerIds, finalRoundScores)` function.
- **Extract shared `RoundData` type** — the `rounds` prop shape (`{ id: string; scores: { userId?, guestId?, blitzPileRemaining, totalCardsPlayed }[] }[]`) is repeated in `ScoringShellProps`, `BetweenRoundsViewProps`, and `GameOverViewProps`.

## Missing Features

- **ColorPrompt/ColorPicker not wired** — components built in Plan 1 but never integrated into game creation flow. Players with no `accentColor` should see the prompt before game starts.

## Feature Flag Cleanup

- **Remove `scoring-revamp` flag gating** — once confident the new UI is solid, remove the flag checks and delete all legacy code paths entirely.
