---
date: 2026-03-27
topic: quick-wins-tranche
---

# Quick Wins Tranche: Public Game Pages, Email Templates, Win Threshold

## What We're Building

Three improvements to ship momentum before tackling the larger orgs migration:

1. **Public game detail pages** (#183/#193) — Let anyone with a game link view the results without logging in. Fixes the broken email link UX.
2. **Email template standardization** (#143) — Fix padding bug in welcome email, align all three templates to site branding (colors, logo, spacing).
3. **Configurable winning score threshold** (#147) — Let players set a custom target score when creating a game instead of the hardcoded 75 points.

## Why This Approach

These are independent, well-scoped changes that each deliver visible value. They clear out long-standing bugs and add a frequently-requested feature, building momentum before the orgs migration.

## Key Decisions

### Public game pages
- **UUID is sufficient security** — no player-membership check needed. Anyone with the link can view.
- **Remove auth at two layers**: middleware (allow `/games/[id]` through) and `getGameById()` query (don't require auth).
- Keep `/games`, `/games/new`, `/games/clone/*` protected.
- Close #183 as resolved by #193.

### Email templates
- **Align to site branding**: `#fff7ea` background (brand cream), `#290806` accent (brand dark), white rounded card container with shadow.
- **Fix padding**: add `padding: "0 48px"` to content section across all templates.
- **Logo in all templates** — welcome has it, bring it to game-complete and friend-request.
- **Consistent spacing** for headings, paragraphs, buttons, dividers, footers.

### Win threshold
- **Schema**: nullable `winThreshold` Int on Game model, defaults to 75.
- **UI**: "Advanced options" section in game creation with presets (50 / 75 / 100 / Custom). Custom allows freeform input, min 25, max 200.
- **Logic**: `determineWinner()` and `isWinningScore()` read threshold from the game record instead of global constant.
- **Display**: show target score in the game view so players know the goal.

## Open Questions

- None — all decisions made during brainstorming.

## Next Steps

→ Write implementation plan and execute
