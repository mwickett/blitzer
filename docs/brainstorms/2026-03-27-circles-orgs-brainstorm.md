---
date: 2026-03-27
topic: circles-clerk-organizations
---

# Circles: Replacing Friends with Clerk Organizations

## What We're Building

Replace Blitzer's peer-to-peer friend system with "Circles" — groups of players built on Clerk Organizations. Circles become the primary social unit: you must belong to at least one to use Blitzer. Games are created within the active circle, scoped to its members. This unlocks per-circle leaderboards, stats comparisons, and future social features.

The friend system (Friend/FriendRequest models, friend queries, mutations, UI) is fully deprecated and removed.

## Why This Approach

The current friend model is flat — everyone is in one global pool. Real Dutch Blitz happens in distinct groups (family, work, game night crew) that don't overlap. Circles model this naturally. Clerk Organizations provide the infrastructure (invitations, membership, switching, webhooks) so we don't build auth/membership from scratch.

We considered keeping friends alongside circles (two social models) but rejected it — circles subsume everything friends do, and maintaining both adds complexity with no benefit.

## Key Decisions

- **"Circle" terminology**: Clerk's localization system renames "Organization" → "Circle" across all Clerk UI components via ClerkProvider localization prop.
- **Hard gate on circle membership**: Middleware redirects to `/circles/setup` if the user has no active `orgId`. No browsing without a circle.
- **Active circle = implicit game scope**: Games belong to whatever circle is active when created (`auth().orgId`). No circle picker in game creation — it's automatic from the Clerk session.
- **Single circle ownership for games**: A game belongs to exactly one circle. No multi-circle visibility.
- **Player pool = circle members + guests**: Game creation shows members of the active circle. Cross-circle player selection is not supported. Guest players remain for non-Blitzer players.
- **Legacy game backfill**: When a user completes first-run setup, their existing games are assigned to their first circle. Player membership in the circle is not validated for historical games.
- **First-run flow**:
  1. User logs in, middleware detects no `orgId`, redirects to `/circles/setup`
  2. Show pending circle invitations (from other users who already set up). Accept/decline.
  3. If no circle after invitations, prompt to create one (name it).
  4. Show existing friends list — tap to invite them (triggers Clerk email invitation using their existing email).
  5. Circle is now active, redirect to dashboard.
  6. Bob scenario: if Bob was invited by Jane before Bob's first-run, Bob sees Jane's circle invitation on his setup page.
- **Friend system removal**: Friend/FriendRequest models, mutations, queries, UI pages, and email template all removed. The friend-request email template can be repurposed as a circle invitation notification if needed.
- **Schema changes**: Add `organizationId` (nullable String) to Game model. Nullable for backward compat during migration — new games always have it set.
- **Clerk integration points**:
  - `auth().orgId` for active circle on every request
  - `<OrganizationSwitcher />` in nav for circle switching
  - `organizationSyncOptions` in middleware for URL-based org activation
  - Webhooks for `organizationMembership.created/deleted` to sync membership data if needed
  - Clerk backend SDK for programmatic invitations during first-run friend migration

## Scope

**In scope:**
- Clerk org integration (middleware, provider config, localization)
- First-run circle setup flow with friend migration
- Schema migration (add organizationId to Game)
- Legacy game backfill
- Update game creation to use circle members instead of friends
- Update all queries to scope by orgId
- Remove friend system (models, mutations, queries, UI, email template)
- Circle switcher in navigation
- Update dashboard/stats to be circle-scoped

**Out of scope (future):**
- Per-circle leaderboards
- Public circle stat pages
- Circle admin roles / permissions
- Circle-scoped AI insights

## Open Questions

None — all decisions made during brainstorming.

## Next Steps

→ Implementation planning. This is a large feature that should be decomposed into phases:
1. Clerk org infrastructure (middleware, provider, localization, first-run gate)
2. Schema migration + game scoping
3. Game creation with circle members
4. First-run setup flow with friend migration
5. Friend system removal
6. Dashboard/stats scoping to active circle
