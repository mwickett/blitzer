# Scoring Revamp Plan 6: Mobile Polish — Identified Items

> Collected from real-device mobile testing (iPhone, Safari) on 2026-03-29. Starting point for brainstorming/planning.

## Mobile Readability

- **Racetrack text too small** — The score labels, player names, and "-10 / 0 / 75 to win" axis labels on the race track are hard to read on a phone screen. Need to increase font sizes for mobile viewports.
- **Graph card text too small** — The Score Progression chart axis labels (0, 8, 16, 24, 32) and player legend text are not comfortably readable on mobile. Same applies to the Hot/Cold and Win Probability cards in the carousel.

## Layout / Spacing

- **Container width misalignment** — The overall viewport isn't fully edge-to-edge or consistently inset. Visible in the screenshot where the racetrack, graph carousel, and standings cards have slightly different horizontal alignment. Needs a consistent container/padding strategy across the between-rounds view.

## UX: Undo Flow

- **Undo toast blocks the standings view** — After submitting a round, the undo countdown toast takes ~5 seconds before the standings appear. But the standings (who's ahead, how far to win) are exactly what players want to see immediately after a round. The undo feature is valuable and worth keeping, but it needs a different mechanism that doesn't delay showing results.
- **Possible approaches to explore in brainstorm:**
  - Show standings immediately with an undo button overlaid (floating or inline) rather than blocking
  - Undo as a persistent option in the round history (tap the round to undo/edit)
  - Snackbar-style undo that doesn't block the main content
  - Brief undo window that shows alongside the results, not instead of them
