---
name: testing-scoring-flow
description: How to test the Blitzer scoring flow end-to-end on Vercel preview deployments. Covers accessing protected previews, Clerk authentication, game creation, score entry, and game completion.
---

# Testing the Blitzer Scoring Flow

## Accessing Vercel Preview Deployments

Vercel preview deployments are protected by team SSO. To access them:

1. Use the Vercel MCP server's `get_access_to_vercel_url` tool:
   ```
   mcp_tool server=vercel tool=get_access_to_vercel_url args={"url": "https://<preview-url>.vercel.app"}
   ```
2. This returns a shareable URL with a `_vercel_share` parameter that bypasses auth (expires in ~23 hours)
3. Navigate to the shareable URL in the browser

## Authentication

- The app uses **Clerk** for authentication
- Test credentials are stored as secrets: `BLITZER_TEST_EMAIL` and `BLITZER_TEST_PASSWORD`
- Login flow: Click "Sign In" → Enter email → Enter ${_repo_secret_mwickett/blitzer_E2E_CLERK_USER_PASSWORD} → Redirected to authenticated app
- The test user is `mwickett-dev` in the org "Seed Org A — Primary"

## Scoring Flow Test Steps

1. **Create a game**: Click "New game" → Add players (use Guest tab for quick setup) → Set winning score (50 for fast testing) → Choose colors → Start Game
2. **Enter round scores**: For each player, enter "Blitz left" and "Cards played" → Submit Round
   - Score formula: `totalCardsPlayed - (2 * blitzPileRemaining)`
3. **Verify between-rounds view**: Check cumulative scores, score progression chart, round scores table
4. **Test game completion**: Enter scores that push a player past the win threshold
5. **Verify game over**: Winner celebration, final standings, stats, round-by-round breakdown
6. **Test re-navigation**: Go to Games list → Click View on the completed game → Verify page loads correctly

## Key UI Components

- `ScoreEntryView`: Score entry with blitz remaining + cards played inputs per player
- `ScoringShell`: Parent component managing scoring modes (entry, betweenRounds, gameOver)
- `BetweenRoundsView`: Shows standings, charts, and round history between rounds
- `GameOverView`: Final results with winner celebration
- `FloatingCTA`: Sticky submit button at bottom of viewport

## What to Watch For

- **Optimistic UI**: After submitting scores, the UI should immediately transition to between-rounds view (no blank screen)
- **Loading state**: Submit button should stay disabled during navigation transition
- **Score accuracy**: Verify cumulative scores match expected values
- **No runtime errors**: The game page should load without errors (check for missing data issues)
