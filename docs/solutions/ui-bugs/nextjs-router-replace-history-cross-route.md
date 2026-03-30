---
title: "Next.js router.replace() fails to replace history entry across route boundaries"
date: 2026-03-30
category: ui-bugs
tags:
  - nextjs
  - app-router
  - router
  - history
  - navigation
  - query-params
  - turbopack
module: src/app/games/new/newGameChooser.tsx
symptoms:
  - "Browser back navigates to ?step=colors instead of clean URL after game creation"
  - "Ghost URL persists in history stack despite router.replace() call"
  - "Submitting a round navigates back to the color selection step"
severity: medium
resolved: true
---

# Next.js `router.replace()` Ghost History Entry Across Route Boundaries

## Symptom

In a multi-step game creation flow (`/games/new` → `/games/new?step=colors` → `/games/[id]`), calling `router.replace("/games/[id]")` from the color step did not replace the `?step=colors` entry in the browser history. Users pressing back or triggering any navigation ended up on `/games/new?step=colors` instead of `/games/new`.

## Root Cause

Next.js App Router's `router.replace()` does not reliably call `window.history.replaceState()` when navigating across different route segments (e.g., `/games/new` → `/games/[id]`). Its internal soft navigation adds a new browser history entry despite "replace" semantics.

This was verified by testing raw browser APIs via Playwright:

```javascript
// Raw browser API works correctly:
window.history.pushState(null, "", "/games/new?step=colors");
window.history.replaceState(null, "", "/games/test-123");
// Back goes to /games/new — ?step=colors is gone. Correct.

// Next.js router.replace() does NOT achieve the same result.
```

## Investigation Steps

1. Tried `window.history.pushState` with a hash (`#colors`) — same ghost entry, plus conflicted with Next.js's own history management.
2. Switched to `useSearchParams` with `router.replace()` for game creation — `?step=colors` still persisted.
3. Added `window.history.replaceState()` before `router.replace()` — Next.js overrode it internally.
4. Used Playwright to test raw `replaceState` + `pushState` — confirmed browser-level replace works. The bug is in Next.js's router layer, not the browser.

## Working Solution

Bypass Next.js router for the history replacement, then use `router.push()` for navigation:

```typescript
if (result && result.gameId) {
  // Use replaceState to remove ?step=colors from history, then
  // push the game URL. Next.js router.replace() doesn't reliably
  // replace the history entry when crossing route boundaries.
  window.history.replaceState(null, "", `/games/${result.gameId}`);
  router.push(`/games/${result.gameId}`);
}
```

Also required: wrap the component using `useSearchParams` in `<Suspense>`:

```tsx
<Suspense>
  <NewGameChooser users={users} />
</Suspense>
```

## Key Insight

When you need true history replacement across route segment boundaries in Next.js App Router, call `window.history.replaceState()` directly before `router.push()`. The `replaceState` call is synchronous and sticks; Next.js then builds on that state when `router.push()` fires.

## Prevention

- **Multi-step forms:** Use a single route with search params (`?step=X`) for all steps. Navigate to a new route only at the terminal action.
- **`router.replace` vs `replaceState`:** Use `window.history.replaceState` when you need to silently update the URL without re-triggering route resolution. Use `router.replace` only when you want Next.js to re-evaluate the route.
- **Rule of thumb:** If steps share a layout and no new server data is needed, stay on one URL with search params.
- **Testing:** Write Playwright tests that assert `window.history.length` before and after transitions, and verify the back button lands on the expected URL.
