# Scoring Revamp Plan 6: Mobile Polish — Design

> Design spec produced by brainstorming on 2026-04-18 based on real-device testing at iPhone 14 Pro viewport (393×852). Follow-up to the Plan 6 notes file (`2026-03-29-scoring-revamp-plan-6-notes.md`) with concrete decisions.

## Goal

Mobile-polish the scoring revamp based on real-device testing. Raise text to legible sizes via breakpoint-aware utilities, remove the undo blocking pattern, fix layout overlaps. This is the last plan before `scoring-revamp/base` ships to main.

## Why

Plans 1–5 shipped the scoring revamp behind the `scoring-revamp` PostHog flag. Device testing on iPhone Safari surfaced four readability/UX issues (captured in the Plan 6 notes file) plus three more found during this brainstorm. Every remaining issue is mechanical or minor-design — no architecture changes.

## Scope

### 1. Racetrack typography (items 1, 7)

Mobile-first `md:` breakpoint sizing in `src/components/scoring/RaceTrack.tsx`:

| Element | Mobile | Desktop (`md:`) |
|---|---|---|
| Single-pill number | `text-sm` (14px) | `text-xs` (12px) |
| Merged-pill number | `text-[13px]` | `text-[11px]` |
| Player name label | `text-[13px]` | `text-xs` (12px) |
| Axis labels (bounds.min / "75 to win") | `text-[13px]` | `text-[11px]` |
| Zero label | `text-[13px]` | `text-[11px]` |
| Single-pill diameter | `w-8 h-8` (32px) | same |
| Merged-pill segment | `min-w-[30px]` | `min-w-[26px]` |
| Merged-pill height | `h-8` | same |

Label top offsets shift from `top-8` → `top-9` to clear the larger pill. Track container height shifts from `h-10` → `h-11` to fit the taller pill cleanly.

Prototype validated in browser during brainstorm. Name overlap on merged pills with long names (`mwickett-clerk` + `mwickett-dev`) is accepted as-is — real Dutch Blitz names (Mike, Sarah, Dan, Jo) are short enough that this rarely triggers.

### 2. Graph card typography (item 2)

Apply the same `md:` pattern to the three graph cards:

- `src/components/scoring/graphs/ScoreProgressionCard.tsx`
- `src/components/scoring/graphs/HotColdCard.tsx`
- `src/components/scoring/graphs/WinProbabilityCard.tsx`

Target elements per card: title, subtitle, axis tick labels, legend labels. Use the same mobile/desktop tokens as the racetrack (`text-[13px] md:text-[11px]` for small text, `text-sm md:text-xs` for emphasized numerics). Recharts props for tick font size need explicit overrides since they're not driven by Tailwind classes.

### 3. Container alignment (item 3)

Audit `src/components/scoring/BetweenRoundsView.tsx` and any child wrappers to use consistent horizontal padding. Current inconsistency: the racetrack wrapper uses `px-4` (16px), while the graph carousel + standings + round scores sit inside a different container with an inner `px-4` on the carousel track specifically. Pick one padding strategy (likely `px-4` on the outer BetweenRoundsView container, no inner padding on children) and apply it uniformly.

Leaves the scroll container itself with consistent edge treatment; inner cards can still have their own internal padding as needed.

### 4. Remove the undo toast (item 4)

Delete the undo flow from the score entry experience:

- In `src/components/scoring/ScoreEntryView.tsx`:
  - Remove `UndoToast` import
  - Remove `undoData` state
  - After `createRoundForGame` resolves, call `router.refresh()` immediately so `ScoringShell` transitions to `betweenRounds` mode right away
  - Remove `handleUndo`/`handleDismissUndo` handlers and their call sites
- In `src/components/scoring/UndoToast.tsx`:
  - Delete the file (tap-to-edit in Round History remains as the only recovery path)
  - Remove any tests for UndoToast
- In `src/server/mutations/rounds.ts`:
  - Remove `deleteLatestRound` mutation (and its PostHog event) if it was only used by undo — verify no other callers first

PostHog tracking impact: the `scoring_round_undone` and `scoring_round_submitted` events remain; only the dismiss event disappears. Issue [#217](https://github.com/mwickett/blitzer/issues/217) will audit overall event coverage post-ship.

### 5. Sticky CTA overlap (item 5)

The floating CTA (`FloatingCTA`) overlaps the Round Scores "Total" row once there are 3+ rounds. Fix by adding `pb-24` (or equivalent) to the scroll container in `BetweenRoundsView.tsx` so content can scroll past the CTA's footprint. Validate the padding value matches the CTA's actual height plus breathing room.

### 6. Carousel peek (item 6)

In `src/components/scoring/GraphCarousel.tsx`:

- Change card min-width from `min-w-[88%]` to `min-w-[82%] md:min-w-[88%]`
- Replace the hardcoded `el.offsetWidth * 0.88` in the scroll handler with a measured stride from the first child: `(firstCard.offsetWidth + 12)` where 12px is the `gap-3` value
- Keep the 2% trailing peek spacer

Result: mobile shows ~15% peek (enough to read "Hot & C…" / "Perfo…"), desktop keeps the tighter 88% card width. Prototype validated in browser.

## Out of scope

- **Item 8** ("N" floating button) — confirmed this is Next.js's dev tools indicator, not a Blitzer component. Won't appear in production builds.
- **Long-name overlap on merged pills** — Option D (accept as-is). Real Dutch Blitz names are short enough.
- **Hot & Cold graph legend truncation** — pre-existing name ellipsis in the legend is not introduced by this plan.
- **Event instrumentation audit** — tracked separately in [#217](https://github.com/mwickett/blitzer/issues/217). The undo-removal decision in (4) above assumes users aren't mistyping often; #217 will instrument tap-to-edit frequency to prove or disprove this after ship.
- **Feature flag removal** — `scoring-revamp` flag and legacy UI paths (`ScoreDisplay`, `ScoreLineGraph`, `GameOver.tsx`) remain gated. Removal is a separate plan after Plan 6 merges and we've had some real-use time with the polished flow.

## Files touched

**Modified:**
- `src/components/scoring/RaceTrack.tsx` — typography + pill sizes
- `src/components/scoring/graphs/ScoreProgressionCard.tsx` — typography
- `src/components/scoring/graphs/HotColdCard.tsx` — typography
- `src/components/scoring/graphs/WinProbabilityCard.tsx` — typography
- `src/components/scoring/BetweenRoundsView.tsx` — container padding audit + bottom padding for CTA
- `src/components/scoring/GraphCarousel.tsx` — card width + handler
- `src/components/scoring/ScoreEntryView.tsx` — remove UndoToast usage

**Deleted:**
- `src/components/scoring/UndoToast.tsx`
- Tests for UndoToast (`src/components/__tests__/scoring/UndoToast.test.tsx` if it exists)

**Potentially modified (verify callers first):**
- `src/server/mutations/rounds.ts` — may remove `deleteLatestRound` if only UndoToast called it

## Exit criteria

- All automated tests still pass (103 baseline — expect a small drop if UndoToast tests get removed)
- Manual mobile smoke test on iPhone Safari: racetrack labels and graph axis labels legible at arm's length
- After merge into `scoring-revamp/base`, [#211](https://github.com/mwickett/blitzer/pull/211) is ready to ship to main
- No regressions on desktop — verify at 1280px that labels aren't oversized and the carousel still feels right

## Open questions for implementation time

- The `deleteLatestRound` mutation: verify call sites before deleting. If admin tooling or something else uses it, keep the mutation and just remove the UndoToast caller.
- Recharts tick font size: need to pick an exact px value (likely 11 mobile / 10 desktop) and pass via the component's `tick={{ fontSize: ... }}` prop. Requires a media-query aware hook if we want breakpoint behavior, or we can just pick one size that reads well enough on both.
