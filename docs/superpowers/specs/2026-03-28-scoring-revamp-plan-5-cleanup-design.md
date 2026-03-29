# Scoring Revamp Plan 5: Cleanup, Deduplication & Color Prompt

## What We're Building

Plan 5 completes the scoring revamp with three workstreams: extract duplicated code into shared utilities, fix the feature flag gating so old and new UI don't render simultaneously, and wire the ColorPrompt into the game creation flow so players choose their deck colors before a game starts.

## Why This Approach

Bottom-up ordering (extract, then fix gating, then build feature) ensures each step lands on clean foundations. Extractions are safe refactors with test coverage. The flag gating fix is a one-line structural change. The ColorPrompt is the only net-new feature — built last on top of deduplicated code.

Legacy code is **not** deleted in this plan. The feature flag stays in place so the old UI remains available for testing. Full removal will happen in a future plan once the new UI has been validated in production.

## Section 1: Code Extractions

### 1a. `findPlayerScore` utility

Extract the identical `findPlayerScore` function from `BetweenRoundsView.tsx:36` and `ScoringShell.tsx:160` into `src/components/scoring/utils.ts`. Pure function — takes a player and a round's scores array, returns the matching score entry by matching `userId` or `guestId`.

### 1b. `useRoundEditing` hook

Extract the duplicated round editing logic from `BetweenRoundsView` and `ScoringShell` into `src/components/scoring/useRoundEditing.ts`.

Duplicated state and handlers:
- `editingRoundIndex` state (`useState<number | null>`)
- `editError` state (`useState<string | null>`) — present in BetweenRoundsView but missing from ScoringShell. The hook must include this so both consumers surface inline errors on failed edits.
- `handleEditRound` callback (sets index, clears error, tracks PostHog event)
- `handleSaveEdit` callback (calls `editRoundScores` mutation, resets state, refreshes router; catches errors and sets `editError`)
- Cancel/reset behavior (clears `editingRoundIndex` and `editError` together)

The hook takes `gameId`, `rounds`, and `players` as inputs. Returns `{ editingRoundIndex, editError, handleEditRound, handleSaveEdit, cancelEdit }`.

### 1c. `breakTie` function

Extract the tie-breaking logic duplicated in `src/lib/gameLogic.ts:determineWinner` and `src/server/mutations/rounds.ts` (winner-update-after-edit) into a shared pure function in `src/lib/scoring/tiebreak.ts`.

Both callers invoke the extracted function instead of implementing tie-breaking inline.

### 1d. Shared `RoundData` type

The rounds prop shape is repeated across `ScoringShellProps`, `BetweenRoundsViewProps`, and `GameOverViewProps`:

```typescript
{ id: string; scores: { userId?: string; guestId?: string; blitzPileRemaining: number; totalCardsPlayed: number }[] }[]
```

Define this once in `src/components/scoring/types.ts` (which already exists) and reference it from all three component prop interfaces.

## Section 2: Fix Feature Flag Gating

The game page (`src/app/games/[id]/page.tsx`) currently renders `ScoreDisplay` unconditionally (line 121-126), outside the feature flag conditional. When the `scoring-revamp` flag is on, both the old score table and the new `ScoringShell` render simultaneously.

**Fix:** ScoreDisplay currently serves as the read-only view for non-circle-members and logged-out users. It cannot simply move into the flag-off branch — that would leave flagged games blank for public viewers.

Result:
- Flag on + circle member: `ScoringShell` only (no `ScoreDisplay` above it)
- Flag on + non-member / logged-out: `ScoreDisplay` (read-only fallback, same as today)
- Flag off: `ScoreDisplay` + `ScoreEntry` (existing behavior)

The conditional becomes: render `ScoreDisplay` unless (flag is on AND user is a circle member who sees `ScoringShell`).

No files are deleted. All legacy components remain in place.

## Section 3: ColorPrompt Integration

Wire the existing `ColorPrompt` and `ColorPicker` components (built in Plan 1, currently only used in dev workbench) into the game creation flow.

### Flow

The game creation page (`src/app/games/new/newGameChooser.tsx`) currently has two sections: player selection and win threshold. After clicking "Start Game," the game is created immediately.

**New behavior:** "Start Game" becomes "Next" and reveals a color selection step. The color step shows all players with a color picker for each. "Back" returns to the player/threshold step. "Start Game" on the color step creates the game with the chosen colors.

### Per-player behavior

- **Current user (game creator) with a saved `accentColor`:** Pre-filled with their default. "Save as my default color" checkbox shown (checked by default). Override allowed.
- **Current user (game creator) without a saved color:** Auto-picks the first available unselected color. "Save as my default color" checkbox shown (checked by default).
- **Other registered users:** Pre-filled with their saved default if they have one, otherwise auto-picks next available. No "Save as default" checkbox — the creator cannot update another user's profile preferences. Color saved to the game record only.
- **Guest users:** Auto-picks the first available unselected color. No "Save as default" checkbox — color saved to game record only. Shows italic note: "Color saved to this game only."

### Conflict resolution

Players are processed top-to-bottom in list order. First player with a given saved default wins it. Later players whose default conflicts are auto-bumped to the next available color. No error message — the picker just shows the fallback pre-selected. The creator can manually adjust any player's color.

### Taken color handling

Each player's picker dims and disables colors already selected by other players. When an earlier player switches to a color currently held by a later player, the later player is auto-bumped to the next available color (cascade reassignment). This prevents duplicate colors despite the interactive UI — the invariant is that no two players can hold the same color at any point.

### Data flow

On confirm:
- Each player's chosen color is passed to the `createGame` mutation as `accentColor` on the game-player record.
- If the current user (game creator) checked "Save as default," update their own user profile's `accentColor`. This uses the existing `updateAccentColor` mutation which only updates the authenticated user's own profile — no new permission model needed.
- The existing `resolvePlayerColor` / `assignColorsToPlayers` pipeline on the game page finds colors already set (instead of auto-assigning).

### Mockup

A visual mockup of this flow is saved at `.superpowers/brainstorm/` in the project directory (served via the brainstorming visual companion during design).

## Key Decisions

- **No legacy deletion:** Old components stay for rollback safety while testing the new UI behind the flag.
- **No feature flag removal:** The `scoring-revamp` flag remains active. Full removal deferred to a future plan.
- **Bottom-up ordering:** Extract shared code first, fix gating second, build ColorPrompt third.
- **Conflict resolution by list order:** Consistent with how `assignColorsToPlayers` already works on the game page.
- **"Save as default" only for the game creator:** Only the authenticated user can update their own profile. Other registered users' colors are saved to the game record only — no delegated profile edits.

## Open Questions

- None — all decisions resolved during brainstorming.

## Next Steps

Proceed to implementation planning via writing-plans skill.
