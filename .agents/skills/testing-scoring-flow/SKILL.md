---
name: testing-scoring-flow
description: How to test the Blitzer scoring flow end-to-end on Vercel preview deployments. Covers protected previews, Clerk authentication, game creation, score entry, finalization, winner edits, and game reopening.
---

# Testing the Blitzer Scoring Flow

## Devin Secrets Needed

- `BLITZER_TEST_EMAIL`: Clerk test user email for Blitzer preview testing.
- `BLITZER_TEST_PASSWORD`: Clerk test user ${_repo_secret_mwickett/blitzer_E2E_CLERK_USER_PASSWORD} for Blitzer preview testing.

## Accessing Vercel Preview Deployments

Vercel preview deployments are protected by team SSO. To access them:

1. Use the Vercel MCP server's `get_access_to_vercel_url` tool:
   ```
   mcp_tool server=vercel tool=get_access_to_vercel_url args={"url": "https://<preview-url>.vercel.app"}
   ```
2. This returns a shareable URL with a `_vercel_share` parameter that bypasses auth (expires in ~23 hours).
3. Navigate to the shareable URL in the browser.
4. If a preview shows a production Server Components error during a score write, use Vercel MCP `get_runtime_logs` for the deployment to distinguish app regressions from expected validation failures.

## Authentication

- The app uses **Clerk** for authentication.
- Source repo-scoped secrets or request `BLITZER_TEST_EMAIL` and `BLITZER_TEST_PASSWORD` if they are missing.
- Login flow: Click "Sign In" → Enter email → Continue → Enter ${_repo_secret_mwickett/blitzer_E2E_CLERK_USER_PASSWORD} → Continue.
- The test user is `mwickett-dev` in the org "Seed Org A — Primary".

## Scoring Flow Test Steps

1. **Create a game**: Click "New game" → Add players (use Guest tab for quick setup) → Set winning score (50 for fast testing) → Choose colors → Start Game.
2. **Enter round scores**: For each player, enter "Blitz left" and "Cards played" → Submit Round.
   - Score formula: `totalCardsPlayed - (2 * blitzPileRemaining)`.
   - Blitzer validation requires at least one player to blitz (`blitzPileRemaining = 0`) in every saved round.
3. **Verify between-rounds view**: Check cumulative scores, score progression chart, round scores table.
4. **Verify persisted ongoing state**: Visit `/games`; the new game should be `Ongoing` before any player crosses the threshold.
5. **Test game completion**: Enter scores that push a player past the win threshold.
6. **Verify game over**: Winner celebration, final standings, stats, round-by-round breakdown.
7. **Verify persisted completed state**: Visit `/games`; the game should be `Completed` with the expected winner.
8. **Edit a finished game to change winner**: Tap the completed game’s Round 2 row, save a new threshold-crossing winner, then verify both the game-over UI and `/games` persisted winner.
9. **Edit a finished game to reopen**: Save a valid round edit that keeps every player below threshold while still including one blitz, then verify the game returns to between-rounds UI and `/games` shows `Ongoing` with no winner.

## Fast 2-Player 50-Point Regression Data

Use a signed-in player and a guest.

1. Round 1 ongoing:
   - Player A: blitz left `0`, cards `30` => `+30`
   - Guest: blitz left `5`, cards `20` => `+10`
2. Round 2 completion for Player A:
   - Player A: blitz left `0`, cards `25` => `+25`, total `55`
   - Guest: blitz left `5`, cards `20` => `+10`, total `20`
3. Finished-game edit to change winner to guest:
   - Player A: blitz left `5`, cards `20` => `+10`, total `40`
   - Guest: blitz left `0`, cards `40` => `+40`, total `50`
4. Finished-game edit to reopen:
   - Player A: blitz left `0`, cards `4` => `+4`, total `34`
   - Guest: blitz left `5`, cards `20` => `+10`, total `20`

## Key UI Components

- `ScoreEntryView`: Score entry with blitz remaining + cards played inputs per player.
- `ScoringShell`: Parent component managing scoring modes (entry, betweenRounds, gameOver).
- `BetweenRoundsView`: Shows standings, charts, and round history between rounds.
- `GameOverView`: Final results with winner celebration.
- `RoundHistoryTable`: Shows round scores and supports tapping rows to edit.
- `RoundEditor`: Inline finished-game editor; saves should recalculate all later totals.
- `FloatingCTA`: Sticky submit button at bottom of viewport.

## What to Watch For

- **Optimistic UI**: After submitting scores, the UI should immediately transition to between-rounds view (no blank screen).
- **Loading state**: Submit button should stay disabled during navigation transition.
- **Score accuracy**: Verify cumulative scores match expected values.
- **Persisted state**: Use `/games` as the source for DB-backed `isFinished`/`winnerId`; the game detail page can derive display state from scores.
- **No runtime errors**: The game page should load without errors. If validation data is invalid, correct the test data rather than treating the validation failure as a finalization regression.
