---
date: 2026-03-28
topic: scoring-experience-revamp
---

# Scoring Experience Revamp

## What We're Building

A mobile-first redesign of the game scoring experience covering three areas: score entry, in-game display, and between-rounds visualizations. Players choose an accent color (mapped to Dutch Blitz deck colors) that carries through all UI elements. The system is built to be pluggable so components like the position visualization and graph library can evolve independently.

## Why This Approach

The current scoring UI works but creates cognitive friction during gameplay — you're juggling a physical card game and a phone, and the UI doesn't guide you through the flow. The biggest pain points in order: (1) losing track of where you are in score entry, (2) cramped layout on mobile, (3) too many taps/fields.

## Key Decisions

### Score Entry — Approach A: "Scorecard Reimagined"
- **Vertical card stack**, one card per player, each with accent color left border
- **Non-linear entry** — tap any player's card in any order (players report scores unpredictably)
- **Status indicators** per card: ○ empty, ½ partial, ✓ complete — instantly shows who's done
- **Sticky round header** with round number + win threshold
- **Sticky submit button** at bottom with remaining count ("Submit Round (2 remaining)")
- Scrolls naturally for 5+ players (expansion packs)

### Position Visualization — V2: "Stacking Pills" (pluggable)
- Single race track showing all players' positions from −20 to 75
- When scores are spread: individual colored circles on the track
- When scores are close: circles merge into multi-color pills
- Extreme clustering: all players merge into one rainbow pill
- Negative scores sit left of the zero line — graceful handling
- **Built as a swappable component** — other options (swim lanes, ring gauges, horizontal bars) can be dropped in later or A/B tested
- Prototypes for all four variants in `docs/brainstorms/racetrack-iterations.html`

### Accent Colors — Dutch Blitz Deck Colors
- **Stored at Circle membership level** — "I always play blue in this group"
- Can also be a **player-level preference** that carries across Circles
- **Per-game override** at game creation to handle conflicts or adjustments
- **Conflict resolution**: first player added to the game keeps their default color; subsequent conflicts get prompted to pick an alternative
- Colors: blue (#3b82f6), red (#ef4444), yellow (#eab308), green (#22c55e), purple (#8b5cf6), orange (#f97316)
- Used consistently in: card borders, track markers, graph lines, leaderboard entries

### Between-Rounds Display
- **Standings list** with rank, accent color, score, and "X away" from win threshold
- **Round score table** showing per-round deltas (+ prefix for gains, red for losses)
- **Graph library** as horizontal swipe carousel with dot indicators:
  - **Hard snap** — one card at a time (like iOS page dots)
  - **Peek** — each card is ~90% width, next card peeks in from the right to signal "more to swipe"
  - Pluggable architecture for adding new chart cards over time

### Score Entry Layout
- **Race track is sticky** — round header + race track stick to top when scrolling through player cards (matters most at 5-6 players)
- **Animations on round submit**:
  - Pills slide along the track to new positions (~300ms)
  - Score delta briefly flashes on each player card ("+18" in green) before settling to new cumulative total

### Graph Library — Initial Set
1. **Score Progression** (line chart) — cumulative scores with accent colors + dashed win threshold
2. **Hot & Cold Streaks** (heatmap grid) — per-round intensity, 🔥 for personal bests
3. **Win Probability** — projected win chance + estimated finish round

Future graphs tracked in GitHub issue #208 (round deltas, blitz pile tracker, score anatomy, head-to-head, round MVPs, consistency meter).

### Score Display Priorities (at a glance)
1. **Relative position** — who's ahead, who's behind, and by how much
2. **Proximity to winning** — how close is the leader to the win threshold
3. **Trend** — is someone surging or slumping (handled by graphs)

## Prototypes

Static HTML mockups served via `npx serve docs/brainstorms`:
- `scoring-prototypes.html` — Approach A with warm brand palette, 4-player + 6-player + between-rounds views
- `racetrack-iterations.html` — Four position visualization variants (swim lanes, stacking pills, horizontal bars, ring gauges)
- `graph-library.html` — Nine graph concepts with consistent data set

## Edge Cases & Rules

### Finish-state transitions
- Celebration fires immediately on submit (no waiting for undo window)
- If user taps Undo during celebration, it cancels — celebration fades, game reopens, scores revert
- The winning round remains editable via the history table, even after game over
- If an edit drops all players below the threshold, the game reopens (back to "in progress")
- Simple rule: a game is "complete" when any player is at or above the threshold after all rounds are applied

### Tie rules
- **Same-round threshold crossing**: highest score wins (e.g., Mike 78 beats Sarah 76)
- **Exact same score on threshold crossing**: the player with fewer blitz cards remaining in the final round wins
- **Mid-game ties**: players share the same rank in standings, no tiebreaker needed

### Racetrack dynamic bounds
- Track domain is dynamic, not fixed at -20..75
- Min bound: `min(lowestScore - 5, -10)` — always show some negative space
- Max bound: `winThreshold` (50, 75, 100, etc.)
- If a player goes below the min bound, the track re-scales dynamically
- Zero line and finish line are positioned proportionally within the dynamic domain

### Status indicator rules
- **Empty** (○): neither field touched — both `null`
- **Partial** (½): exactly one field has a value (including 0 — a field set to 0 is intentional)
- **Complete** (✓): both fields have a value (including 0)
- Key distinction: `null` = untouched, `0` = intentionally entered zero

### Submit / error handling
- Disable button immediately on tap (double-submit prevention)
- Optimistic UI: update scores locally, show undo toast
- If server save fails: error toast with "Retry", revert local state
- Undo and edit saves follow same optimistic + retry pattern
- Idempotency key per round submission

### Accent color precedence (in priority order)
1. Per-game override (highest)
2. Player-level default (set via first-game prompt or "save as default")
3. No default → prompted to pick on game start
- Guests: game creator assigns their color
- Rematch/cloned games: carry forward color assignments from previous game

### Player cap
- UI capped at 6 players for now (6 accent colors defined)
- Dutch Blitz supports up to 8 with expansion sets — add 2 more colors if/when 8-player support ships

### Win Probability graph
- Linear extrapolation based on average points-per-round
- Minimum 3 rounds before the graph appears
- Recalculates after edits
- "Based on scoring pace" disclaimer shown
- No ML or uncertainty intervals — keep it simple

## Known Polish Items

- Color picker dots overflow on narrow screens — needs wrapping or a different layout
- Race track finish line (🏁 + "75 to win" label) is cramped on the right edge — needs more breathing room
- Pill name labels below the track may need refinement at extreme clustering

## Resolved Questions

- **Color picker location**: Circle membership level (or player-level) default + per-game override at game creation
- **Conflict resolution**: First-come priority — first player added keeps their default, conflicts get prompted
- **Graph navigation**: Horizontal swipe carousel with hard snap + peek (next card visible at edge)
- **Race track sticky**: Yes — header + track pin to top on scroll
- **Animations**: Pill slide (~300ms) + score delta flash on player cards
- **Round editing**: Undo toast (~5s with countdown) right after submit + tappable history rows with inline edit card. Changed fields highlighted in yellow, live delta recalculation, cascading score update on save.
- **Game over**: Hybrid celebration — brief color flash (winner's accent color, confetti, trophy bounce, ~2s) then fade to final results view with winner card, standings with per-player stats, game stats grid, mini score progression, and "New Game with Same Players" / "Back to Circle" actions. Prototype in `docs/brainstorms/game-over.html`.
- **Between-rounds layout**: Option B — Track → Graphs → Standings → Score Table. No section labels (redundant). Prototype in `docs/brainstorms/between-rounds-layout.html`.
- **Floating CTA button**: Always visible at bottom. Contextual states: "Submit Round (X remaining)" during entry (green when ready, disabled otherwise), "Enter Round N Scores" between rounds (brand color), "Save Changes"/"Cancel" during editing, hidden during game over. Bottom padding spacer on content to prevent overlap.
- **Color picker onboarding**: No dedicated settings page. First game prompt — pick your color when you first play, saves as default. Game creation override has "save as my default" option. Zero extra UI to build upfront.

## Interactive Workbench

Live at `/dev/workbench` — fully functional prototype with:
- Score entry with status indicators (empty/partial/complete)
- Stacking pills race track with adjustable merge threshold
- Color picker with duplicate prevention
- Player add/remove (2-6 players)
- Round history table
- Configurable win threshold

## Implementation Principles

### Testing foundation
Build integration tests alongside each interaction as we go. The scoring flow has many stateful transitions (entry → submit → undo → between rounds → edit → game over) that are easy to break when iterating. At minimum, set up the test harness and write coverage for the core happy paths so future work has a safety net. Use the workbench as a reference for what interactions need coverage.

### Emerging design system
This work is establishing patterns (accent colors, card components, floating CTA, status indicators, the warm palette) that will extend to other screens. Implementation should extract shared primitives — color tokens, card styles, the pill/track components, the floating action button — as reusable components from the start, not as a refactor later. Think of this as the seed of a design system, not a one-off feature build.

## Next Steps

→ `/workflows:plan` for implementation details
