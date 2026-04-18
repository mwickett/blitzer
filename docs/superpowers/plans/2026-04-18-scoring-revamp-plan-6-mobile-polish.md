# Scoring Revamp Plan 6: Mobile Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the scoring revamp UI to mobile-ready polish — legible text via breakpoint-aware sizing, removal of the 5-second undo blocker, fixed layout overlaps, and a wider graph carousel peek — so `scoring-revamp/base` can ship to main.

**Architecture:** Bottom-up, mechanical changes first (typography bumps across 4 components), then behavioral change (remove undo), then layout tidying (alignment + CTA overlap) and interaction polish (carousel peek). No new components, no schema changes, no new routes. Design spec at `docs/superpowers/specs/2026-04-18-scoring-revamp-plan-6-mobile-polish-design.md`.

**Tech Stack:** Next.js App Router, React client components, Tailwind CSS, Recharts, Jest + Testing Library, PostHog, TypeScript.

---

## File Structure

**Modified files:**
- `src/components/scoring/RaceTrack.tsx` — breakpoint-aware typography + pill sizes
- `src/components/scoring/graphs/ScoreProgressionCard.tsx` — breakpoint-aware title/subtitle typography, recharts tick size
- `src/components/scoring/graphs/HotColdCard.tsx` — same
- `src/components/scoring/graphs/WinProbabilityCard.tsx` — same
- `src/components/scoring/BetweenRoundsView.tsx` — horizontal padding alignment + taller bottom spacer
- `src/components/scoring/GraphCarousel.tsx` — card min-width + measured scroll stride
- `src/components/scoring/ScoreEntryView.tsx` — remove undo state and UndoToast render, call `router.refresh()` immediately on submit
- `src/components/__tests__/scoring/ScoreEntryView.test.tsx` — remove undo-related tests, add test that `router.refresh()` is called after submit

**Deleted files:**
- `src/components/scoring/UndoToast.tsx`

**Potentially touched (verify first in Task 6):**
- `src/server/mutations/rounds.ts` — remove `deleteLatestRound` if no other callers
- `src/server/mutations.ts` and `src/server/mutations/index.ts` — remove re-exports if deleted

---

### Task 1: Racetrack typography — breakpoint-aware sizes

**Files:**
- Modify: `src/components/scoring/RaceTrack.tsx`

Pure visual change. Existing tests (`src/lib/__tests__/racetrack.test.ts`) cover the logic helpers and are unaffected. Manual smoke test via browser on mobile viewport.

- [ ] **Step 1: Read the current file**

Run: `cat src/components/scoring/RaceTrack.tsx`

Note the existing class names on lines 37 (axis labels), 49 (zero label), 75 (single-pill number), 81 (single-pill name), 99 (merged container height), 103 (merged-pill number), 110 (merged-name offset), 114 (merged name text).

- [ ] **Step 2: Apply typography + pill size changes**

In `src/components/scoring/RaceTrack.tsx`, make these replacements:

1. Axis labels wrapper (around line 37):

```tsx
<div className="flex justify-between text-[13px] md:text-[11px] text-[#8b5e3c] mb-1.5 px-0.5">
```
(was `text-[9px]`)

2. Track container (around line 42):

```tsx
<div className="relative h-11 bg-[#f0e6d2] rounded-full overflow-visible">
```
(was `h-10`)

3. Zero label (around line 49):

```tsx
<div
  className="absolute -top-4 text-[13px] md:text-[11px] text-[#8b5e3c] -translate-x-1/2"
  style={{ left: `${zeroPos}%` }}
>
  0
</div>
```
(was `text-[8px]`)

4. Single-pill circle (around line 75):

```tsx
<div
  className="w-8 h-8 rounded-full border-[2.5px] border-[#fff7ea] shadow-sm flex items-center justify-center text-sm md:text-xs font-bold text-white"
  style={{ backgroundColor: m.color }}
>
  {m.score}
</div>
```
(was `w-7 h-7 ... text-[8px]`)

5. Single-pill name label (around line 81):

```tsx
<div
  className="absolute top-9 left-1/2 -translate-x-1/2 text-[13px] md:text-xs font-semibold whitespace-nowrap"
  style={{ color: m.score < 0 ? "#b91c1c" : m.color }}
>
  {m.name}
</div>
```
(was `top-8 ... text-[8px]`)

6. Merged-pill container (around line 99):

```tsx
<div className="flex h-8 rounded-full border-[2.5px] border-[#fff7ea] shadow-sm overflow-hidden">
```
(was `h-7`)

7. Merged-pill segments (around line 103):

```tsx
<div
  key={m.id}
  className="min-w-[30px] md:min-w-[26px] h-full flex items-center justify-center text-[13px] md:text-[11px] font-bold text-white px-1.5"
  style={{ backgroundColor: m.color }}
>
  {m.score}
</div>
```
(was `min-w-[22px] ... text-[7px] px-1`)

8. Merged-pill name wrapper (around line 110):

```tsx
<div className="absolute top-9 left-1/2 -translate-x-1/2 flex gap-1.5 whitespace-nowrap">
```
(was `top-8 gap-1`)

9. Merged-pill name text (around line 114):

```tsx
<span
  key={m.id}
  className="text-[13px] md:text-[11px] font-semibold"
  style={{ color: m.score < 0 ? "#b91c1c" : m.color }}
>
  {m.name}
</span>
```
(was `text-[7px]`)

- [ ] **Step 3: Run test suite to confirm logic is unaffected**

Run: `npm test -- --testPathPattern=scoring`
Expected: all scoring tests pass (no logic changes, only JSX class names).

- [ ] **Step 4: Manual smoke test**

Start dev server if not already running: `npm run dev`

Open in a browser at mobile viewport (393×852 in devtools):
1. Navigate to any active game page (e.g. http://localhost:3000/games — click View Game)
2. Confirm race track pill numbers and player names are legible at arm's length
3. Resize to ~1280px and confirm racetrack isn't oversized

- [ ] **Step 5: Commit**

```bash
git add src/components/scoring/RaceTrack.tsx
git commit -m "feat(scoring): breakpoint-aware typography on race track

Mobile gets 13-14px for readability; desktop stays at 11-12px.
Pill diameter 28→32px to accommodate larger text inside the circle."
```

---

### Task 2: Graph card typography — same breakpoint pattern

**Files:**
- Modify: `src/components/scoring/graphs/ScoreProgressionCard.tsx`
- Modify: `src/components/scoring/graphs/HotColdCard.tsx`
- Modify: `src/components/scoring/graphs/WinProbabilityCard.tsx`

Apply the `md:` breakpoint pattern to card titles, subtitles, legend labels. Recharts tick font sizes are passed via the `tick={{ fontSize: ... }}` prop on the axis components — use `12` (between mobile 13 and desktop 11) since SVG text can't use Tailwind breakpoints without extra plumbing.

- [ ] **Step 1: Read each card file to find the targets**

Run: `cat src/components/scoring/graphs/ScoreProgressionCard.tsx src/components/scoring/graphs/HotColdCard.tsx src/components/scoring/graphs/WinProbabilityCard.tsx`

Identify: card title (typically an `<h3>` or `<div>` with heading class), subtitle (paragraph below), any legend labels, and Recharts `<XAxis>`/`<YAxis>` `tick` props.

- [ ] **Step 2: Apply breakpoint typography to each card**

In each of the three files, apply these patterns:

- Title (currently likely `text-sm font-bold` or similar): change to `text-base md:text-sm font-bold` (16px mobile, 14px desktop)
- Subtitle (currently likely `text-xs text-[#8b5e3c]`): change to `text-[13px] md:text-xs text-[#8b5e3c]`
- Any legend text (Recharts `<Legend>` typically uses a render prop; look for inline `text-[10px]` or similar and change to `text-[13px] md:text-[11px]`)
- Recharts `<XAxis>` / `<YAxis>`: set `tick={{ fontSize: 12, fill: "#8b5e3c" }}` — if currently a smaller size, this is a bump

If a card uses a `ResponsiveContainer` with a custom legend component, adjust that component's text sizing the same way.

- [ ] **Step 3: Run test suite**

Run: `npm test`
Expected: all tests still pass.

- [ ] **Step 4: Manual smoke test — mobile**

With dev server running, open the game page at mobile viewport:
1. Swipe through all three graphs in the carousel
2. Verify axis labels, titles, subtitles, legends all legible
3. Check that Recharts' 12px ticks don't look out of place

- [ ] **Step 5: Manual smoke test — desktop**

Resize browser to 1280×800:
1. Confirm the three graphs don't look oversized
2. Subtitles/titles should feel compact

- [ ] **Step 6: Commit**

```bash
git add src/components/scoring/graphs/
git commit -m "feat(scoring): breakpoint-aware typography on graph cards

Titles, subtitles, legends use the same 13/11px mobile/desktop pattern
as the race track. Recharts tick labels use a flat 12px (SVG text can't
easily use breakpoints)."
```

---

### Task 3: Container alignment — unify horizontal padding in BetweenRoundsView

**Files:**
- Modify: `src/components/scoring/BetweenRoundsView.tsx`

Current state: racetrack wrapper uses `px-5` (20px), graph carousel / standings use internal `px-4` / `mx-4` (16px). Result: racetrack sits 4px further outboard than the rest. Fix by dropping the racetrack wrapper to `px-4`.

- [ ] **Step 1: Apply the padding change**

In `src/components/scoring/BetweenRoundsView.tsx`, find the race track wrapper (around line 70):

```tsx
{/* Race Track */}
<div className="px-4 pt-4 pb-2">
  <RaceTrack players={players} winThreshold={winThreshold} />
</div>
```
(was `px-5 pt-4 pb-2`)

Also check `src/components/scoring/ScoreEntryView.tsx` for the race track wrapper at line 174:

```tsx
{/* Race Track */}
<div className="px-4 pt-2 pb-2">
  <RaceTrack players={players} winThreshold={winThreshold} />
</div>
```
(was `px-5 pt-2 pb-2`)

- [ ] **Step 2: Run test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Manual smoke test**

Mobile viewport, navigate to a between-rounds view:
1. Eyeball the left edge of the race track vs the left edge of the graph carousel
2. They should align to within a pixel or two

- [ ] **Step 4: Commit**

```bash
git add src/components/scoring/BetweenRoundsView.tsx src/components/scoring/ScoreEntryView.tsx
git commit -m "fix(scoring): align race track padding with other sections

Drop px-5 to px-4 so race track sits flush with graph carousel,
standings, and round history."
```

---

### Task 4: Sticky CTA bottom spacer — raise from h-20 to h-28

**Files:**
- Modify: `src/components/scoring/BetweenRoundsView.tsx`

The `h-20` (80px) spacer at the bottom of BetweenRoundsView isn't enough to clear the FloatingCTA's footprint when content is scrolled to the bottom — the Round Scores "Total" row gets partially obscured. Bump to `h-28` (112px).

- [ ] **Step 1: Apply the spacer change**

In `src/components/scoring/BetweenRoundsView.tsx`, find the bottom spacer (around line 132-133):

```tsx
{/* Bottom spacer for floating CTA */}
<div className="h-28" />
```
(was `h-20`)

- [ ] **Step 2: Manual smoke test**

Dev server running, mobile viewport. Submit enough rounds that the Round Scores table has 3+ rows:
1. Scroll to the bottom
2. The "Total" row should be fully visible above the floating CTA

- [ ] **Step 3: Commit**

```bash
git add src/components/scoring/BetweenRoundsView.tsx
git commit -m "fix(scoring): taller bottom spacer so CTA doesn't cover totals row

h-20 wasn't clearing the floating CTA's height + margin. Bumped to h-28."
```

---

### Task 5: Graph carousel — widen peek + use measured stride

**Files:**
- Modify: `src/components/scoring/GraphCarousel.tsx`

Change card min-width to `min-w-[82%] md:min-w-[88%]` and replace the hardcoded `0.88` in the scroll handler with the actual measured stride of the first child (card width + gap).

- [ ] **Step 1: Apply the changes**

In `src/components/scoring/GraphCarousel.tsx`:

1. Replace the handleScroll function (around line 17):

```tsx
const handleScroll = () => {
  const scrollLeft = el.scrollLeft;
  const firstCard = el.firstElementChild as HTMLElement | null;
  if (!firstCard) return;
  const cardStride = firstCard.offsetWidth + 12; // card width + gap-3
  const index = Math.round(scrollLeft / cardStride);
  setActiveIndex(Math.min(index, children.length - 1));
};
```
(was `const cardWidth = el.offsetWidth * 0.88;` with `Math.round(scrollLeft / cardWidth)`)

2. Update the card wrapper className (around line 38):

```tsx
<div
  key={i}
  className="min-w-[82%] md:min-w-[88%] snap-start"
>
```
(was `min-w-[88%]`)

- [ ] **Step 2: Run test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Manual smoke test**

Mobile viewport, between-rounds view with all three graphs available:
1. The next card's title should be partially readable ("Hot & C…" instead of "Ho…")
2. Swipe-snap behavior should still feel right — each swipe advances exactly one card
3. Dot indicators should update correctly as you swipe

Resize to desktop (1280px):
1. Cards should hold 88% width — similar to previous behavior

- [ ] **Step 4: Commit**

```bash
git add src/components/scoring/GraphCarousel.tsx
git commit -m "feat(scoring): wider carousel peek on mobile, measured scroll stride

Mobile cards are 82% width (vs 88%) so the next card's title shows
legibly rather than a 2-char hint. Desktop unchanged at 88%. Scroll
handler now measures the first child's actual width instead of
assuming 88%, so the active-index calc matches whatever the rendered
stride is."
```

---

### Task 6: Remove undo flow from ScoreEntryView (TDD)

**Files:**
- Modify: `src/components/__tests__/scoring/ScoreEntryView.test.tsx` — update existing tests
- Modify: `src/components/scoring/ScoreEntryView.tsx`

The undo-related tests in `ScoreEntryView.test.tsx` expect undo behavior that will no longer exist. Update the tests first (they should fail), then change the component.

- [ ] **Step 1: Read the current tests**

Run: `cat src/components/__tests__/scoring/ScoreEntryView.test.tsx`

Note any tests that reference: `UndoToast`, `handleUndo`, `handleDismissUndo`, `deleteLatestRound`, `"Undo"` button text. These all need to go.

- [ ] **Step 2: Update the test file — delete undo tests, add a refresh test**

In `src/components/__tests__/scoring/ScoreEntryView.test.tsx`:

1. Remove the `deleteLatestRound` line from the `jest.mock("@/server/mutations", ...)` call. New mock:

```tsx
jest.mock("@/server/mutations", () => ({
  createRoundForGame: jest.fn().mockResolvedValue({ id: "round-1" }),
}));
```

2. Add a router mock near the top of the file (after the crypto.randomUUID mock):

```tsx
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));
```

3. Delete the entire `it("shows undo toast after submit", ...)` block (currently lines 102-128 in the existing test file). That's the one that asserts the undo toast text appears.

4. Replace it with a test that verifies refresh is called after submit. Match the existing file's patterns — `getAllByPlaceholderText("—")` for inputs, `getByText("Submit Round")` for the button:

```tsx
it("calls router.refresh after successful submit", async () => {
  mockRefresh.mockClear();
  render(
    <ScoreEntryView
      gameId="game-1"
      currentRoundNumber={1}
      players={mockPlayers}
      winThreshold={75}
    />
  );

  // Fill all inputs (2 per player = 4 total)
  const inputs = screen.getAllByPlaceholderText("—");
  fireEvent.change(inputs[0], { target: { value: "0" } });
  fireEvent.change(inputs[1], { target: { value: "18" } });
  fireEvent.change(inputs[2], { target: { value: "5" } });
  fireEvent.change(inputs[3], { target: { value: "14" } });

  fireEvent.click(screen.getByText("Submit Round"));

  await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
});
```

- [ ] **Step 3: Run the test — expect the new one to fail**

Run: `npm test -- --testPathPattern=ScoreEntryView`
Expected: the new "calls router.refresh after successful submit" test FAILS because the current code defers refresh to the undo timer instead of calling it immediately. Old undo tests may have been removed, so they won't appear.

- [ ] **Step 4: Remove the undo flow from ScoreEntryView**

In `src/components/scoring/ScoreEntryView.tsx`:

1. Remove the `UndoToast` import (line 10).
2. Change the mutations import (line 14) to:

```tsx
import { createRoundForGame } from "@/server/mutations";
```

3. Remove the `undoData` state block (lines 38-42).

4. Rewrite `handleSubmit` (lines 72-134) to the following. Key differences: no undoData state, no preSubmitEntries tracking, router.refresh called immediately on success:

```tsx
const handleSubmit = useCallback(async () => {
  if (!allComplete || isSubmitting) return;
  setIsSubmitting(true);
  setError(null);

  const scores = players.map((player) => {
    const entry = entries[player.id];
    return {
      ...(player.isGuest
        ? { guestId: player.guestId }
        : { userId: player.userId }),
      blitzPileRemaining: entry.blitzRemaining ?? 0,
      totalCardsPlayed: entry.cardsPlayed ?? 0,
    };
  });

  const preSubmitEntries = { ...entries };

  try {
    validateGameRules(scores);

    const deltas: Record<string, number> = {};
    for (const player of players) {
      const entry = entries[player.id];
      deltas[player.id] = calculateRoundScore({
        blitzPileRemaining: entry.blitzRemaining ?? 0,
        totalCardsPlayed: entry.cardsPlayed ?? 0,
      });
    }
    setOptimisticDeltas(deltas);
    if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current);
    deltaTimerRef.current = setTimeout(() => setOptimisticDeltas(null), 1200);

    setEntries(
      Object.fromEntries(
        players.map((p) => [p.id, { blitzRemaining: null, cardsPlayed: null }])
      )
    );

    await createRoundForGame(gameId, currentRoundNumber, scores);
    posthog.capture("scoring_round_submitted", {
      game_id: gameId,
      round_number: currentRoundNumber,
      player_count: players.length,
    });
    setIsSubmitting(false);
    router.refresh();
  } catch (e) {
    setEntries(preSubmitEntries);
    setOptimisticDeltas(null);
    setError(e instanceof Error ? e.message : "Failed to submit round");
    setIsSubmitting(false);
  }
}, [allComplete, isSubmitting, players, entries, gameId, currentRoundNumber, posthog, router]);
```

5. Delete the `handleUndo` useCallback (was lines 136-159).

6. Delete the `handleDismissUndo` useCallback (was lines 161-164).

7. Delete the undo toast JSX in the return block (was lines 217-224):

```tsx
{/* Undo toast block removed */}
```

Just delete that block entirely.

- [ ] **Step 5: Run the tests again — expect pass**

Run: `npm test -- --testPathPattern=ScoreEntryView`
Expected: all tests pass, including the new `calls router.refresh after successful submit` test.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Manual smoke test**

Mobile viewport, navigate to an active game and submit a round:
1. Confirm: no undo toast appears
2. The between-rounds view (standings + graphs) renders immediately
3. Error case: enter invalid scores (e.g. two players with 0 cards played — validation fails). Confirm error banner shows with retry button.

- [ ] **Step 8: Commit**

```bash
git add src/components/scoring/ScoreEntryView.tsx src/components/__tests__/scoring/ScoreEntryView.test.tsx
git commit -m "feat(scoring): remove undo toast, show standings immediately on submit

The 5s undo delay was blocking the standings view — players reported
wanting to see results immediately. Removed undoData state and
UndoToast render. Recovery path is tap-to-edit in round history
(already in place since Plan 3). #217 will instrument tap-to-edit
frequency to validate this call after ship."
```

---

### Task 7: Delete UndoToast.tsx + clean up deleteLatestRound if unused

**Files:**
- Delete: `src/components/scoring/UndoToast.tsx`
- Potentially modify: `src/server/mutations/rounds.ts`, `src/server/mutations/index.ts`, `src/server/mutations.ts`

The workbench has its own inline UndoToast so deleting the real one is safe. `deleteLatestRound` is a server mutation; verify no remaining callers before removing.

- [ ] **Step 1: Confirm UndoToast has no remaining callers**

Run: `grep -rn 'UndoToast' src/ --include='*.tsx' --include='*.ts'`
Expected: only `src/components/scoring/UndoToast.tsx` (the file itself) and `src/app/dev/workbench/page.tsx` (which defines its own local UndoToast — note no import from `@/components`). No import from `@/components/scoring/UndoToast` should remain.

If the workbench import the real UndoToast, stop and investigate. Otherwise continue.

- [ ] **Step 2: Delete UndoToast.tsx**

```bash
rm src/components/scoring/UndoToast.tsx
```

- [ ] **Step 3: Confirm deleteLatestRound has no remaining callers**

Run: `grep -rn 'deleteLatestRound' src/ --include='*.tsx' --include='*.ts'`
Expected after Task 6: only `src/server/mutations/rounds.ts` (definition), `src/server/mutations/index.ts` (re-export), `src/server/mutations.ts` (re-export). No usage in any component or page file.

If any component still imports `deleteLatestRound`, leave the mutation in place and skip to Step 5. Otherwise continue.

- [ ] **Step 4: Remove deleteLatestRound**

1. In `src/server/mutations/rounds.ts`: delete the entire `export async function deleteLatestRound(...)` function.
2. In `src/server/mutations/index.ts`: remove `deleteLatestRound` from the import and from the exported object.
3. In `src/server/mutations.ts`: remove `deleteLatestRound` from the import and from the `export { ... }` statement.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Run the build to confirm no broken imports**

Run: `npm run build`
Expected: build succeeds. If it fails because a page/component still imports `deleteLatestRound`, investigate that caller — either it was missed in Task 6 or there's an unexpected usage.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(scoring): delete UndoToast component and deleteLatestRound mutation

No longer used after Plan 6 removed the undo flow."
```

---

### Task 8: Full regression sweep and cleanup

**Files:** None modified; verification only.

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass. Note the test count — it should be at or near 103 (the baseline). A small drop of 1-2 tests is acceptable if undo tests were removed in Task 6.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: build succeeds, no TypeScript errors, no missing imports.

- [ ] **Step 3: Mobile smoke test — full flow**

Dev server running, mobile viewport (393×852 in devtools):
1. Navigate to `/games` and open an active game (or create a new one)
2. Enter scores for one round — verify submit transitions immediately to between-rounds
3. Swipe through all three graphs — verify peek shows card titles partially
4. Scroll to the bottom of the between-rounds view — verify Round Scores "Total" row is visible
5. Tap a row in Round History to edit — verify editor opens, save succeeds
6. Confirm race track labels and pill numbers are legible

- [ ] **Step 4: Desktop smoke test**

Resize browser to 1280×800:
1. Revisit the same game
2. Race track, graphs, and standings should look proportional — not oversized
3. Carousel cards should be wider (88%) than on mobile

- [ ] **Step 5: Push the branch**

```bash
git push -u origin scoring-revamp/6-mobile-polish
```

- [ ] **Step 6: Open a PR into scoring-revamp/base**

```bash
gh pr create --base scoring-revamp/base --title "Plan 6: mobile polish" --body "$(cat <<'EOF'
## Summary

- **Typography:** Breakpoint-aware sizing on race track and three graph cards (mobile 13-14px, desktop 11-12px). Pill diameter bumped 28→32px to fit larger text.
- **Undo removal:** Deleted UndoToast component and the 5-second blocking toast. Submit now shows standings immediately via router.refresh. Recovery path is tap-to-edit in round history. [#217](https://github.com/mwickett/blitzer/issues/217) will instrument events to validate this after ship.
- **Layout fixes:** Race track wrapper padding dropped from px-5 to px-4 to align with graph carousel/standings. Bottom spacer raised from h-20 to h-28 so the Round Scores Total row isn't obscured by the floating CTA.
- **Carousel peek:** Cards are 82% width on mobile (88% on desktop) so the next card title is legible rather than a 2-character hint. Scroll handler uses measured stride instead of the hardcoded 0.88 multiplier.

## Test plan

- [ ] `npm test` passes (expect ~103 tests, small drop possible from removed undo tests)
- [ ] Enter a round: submit transitions immediately to between-rounds view (no 5s delay)
- [ ] Race track pills and labels legible on iPhone Safari at arm's length
- [ ] Swipe graph carousel: next card title is partially visible ("Hot & C…")
- [ ] Scroll to bottom of between-rounds: Round Scores Total row fully visible above CTA
- [ ] Tap a round in history → editor opens → save works (no undo UI anywhere)
- [ ] Desktop (1280px): nothing looks oversized; carousel cards are wider
- [ ] `npm run build` succeeds

Design spec: docs/superpowers/specs/2026-04-18-scoring-revamp-plan-6-mobile-polish-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR created and URL returned.
