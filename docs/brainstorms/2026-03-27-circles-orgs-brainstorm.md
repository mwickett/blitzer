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

### Terminology
- Clerk's localization system renames "Organization" → "Circle" across all Clerk UI components via `ClerkProvider` localization prop.
- Limitation acknowledged: Clerk's hosted Account Portal pages will still say "Organization." Acceptable — those interactions are rare and we use embedded components wherever possible.

### Access Control

| Action | Who can do it? |
|--------|---------------|
| View game details | Anyone with the UUID (stays public for email links) |
| Enter scores | Circle members only, game not finished |
| Edit scores | Circle members only, game not finished |
| Finish game | Circle members (automatic when threshold hit) |
| Clone game | Circle members only |
| Create game | Circle members only (active circle sets orgId) |

### Circle Membership & Data
- **Hard gate on circle membership**: Middleware redirects to `/circles/setup` if the user has no active `orgId`. No browsing without a circle.
- **Active circle = implicit game scope**: Games belong to whatever circle is active when created (`auth().orgId`). No circle picker in game creation.
- **Session-only context**: Circle context comes from Clerk session, not URL slugs. Existing URL structure stays. Circle switcher in nav makes active circle clear.
- **Single circle ownership for games**: A game belongs to exactly one circle. No multi-circle visibility.
- **Player pool = circle members + guests**: Game creation shows members of the active circle. Cross-circle player selection is not supported.

### Games & Stats Scoping
- **Games list** (`/games`): filtered to active circle's games only.
- **Dashboard stats** (batting average, cumulative score, high/low, etc.): all user's games regardless of circle — personal stats reflect full history.
- **Game creation**: scoped to active circle.
- **Legacy games**: not backfilled. Games without `organizationId` are archived. A "Legacy Games" read-only page shows pre-circle history. Legacy games still count toward personal dashboard stats.

### Guest Ownership
- **Guests are circle-owned**, not creator-owned. `GuestUser` gets an `organizationId` field.
- Any circle member can see and use circle guests in game creation.
- This unlocks a future "upgrade guest to full member" invitation flow.

### Membership Data Strategy
- **No local membership mirror.** Follow Clerk's recommended approach: session token → API on demand → webhooks only if needed.
- `auth().orgId` for authorization checks (zero latency, from JWT).
- `useOrganization({ memberships: true })` or `clerkClient` for listing circle members (game creation player picker).
- Existing `user.created/updated` webhooks continue syncing the User table for names/avatars.
- No `OrganizationMembership` table needed.

### Roles & Permissions
- Configure a custom "member" role in Clerk dashboard that includes invitation permission but not destructive actions (delete org, remove members).
- Circle creators get admin role (Clerk default).
- All members can invite others to the circle.
- This is Clerk dashboard configuration, not application code.

### First-Run Flow
- **Custom page** (`/circles/setup`) — not Clerk's built-in org session task handler. We need custom UI for the friend migration step.
- Embeds Clerk components where useful (`<CreateOrganization />`, invitation API).
- Setup page excluded from the org-required middleware check.

**Flow:**
1. User logs in, middleware detects no `orgId`, redirects to `/circles/setup`.
2. Show pending circle invitations (from users who already set up). Accept/decline.
3. If no circle after invitations, prompt to create one via `<CreateOrganization />`.
4. Show existing **accepted** friends list — tap to invite them (triggers Clerk email invitation using their Clerk email).
5. Circle is now active, redirect to dashboard.
6. **Bob scenario**: if Jane invited Bob before Bob logs in post-migration, Bob sees Jane's circle invitation at step 2.

**Migration edge cases:**
- Pending friend requests (incoming/outgoing): ignored. Only accepted friends shown.
- Duplicate invites: Clerk handles gracefully (no-op for same email).
- Partial failures: show error toast for failed invites, don't block setup.
- Email drift: use Clerk email (source of truth), not stored email in User table.
- Users already in the circle: hidden from the invite list.

### Friend System Removal
- Remove: `Friend` and `FriendRequest` models from schema
- Remove: `src/server/mutations/friends.ts`, friend queries, barrel re-exports
- Remove: `/friends` page, `/friends/add` page, `IncomingFriendRequests` component, `SelectUser` component
- Remove: friend-request email template (or repurpose for circle invitation)
- Migration to drop Friend/FriendRequest tables

### Schema Changes
- Add `organizationId` (nullable String) to `Game` model. Nullable for legacy games — new games always have it set.
- Add `organizationId` (nullable String) to `GuestUser` model. New guests always associated with active circle.
- Migration to add columns.
- No new tables needed (no local membership mirror).

## Scope

**In scope:**
- Clerk org integration (middleware, provider config, localization)
- Custom first-run circle setup flow with friend migration
- Schema migration (add organizationId to Game and GuestUser)
- Legacy games archive page
- Update game creation to use circle members (via Clerk API) instead of friends
- Update games list query to scope by orgId
- Guest users become circle-owned
- Access control: write operations restricted to circle members, scores not editable on finished games
- Remove friend system (models, mutations, queries, UI, email template)
- Circle switcher in navigation (`<OrganizationSwitcher />`)
- Custom Clerk member role with invite permission (dashboard config)

**Out of scope (future):**
- Per-circle leaderboards
- Public circle stat pages
- URL-based circle routing (org slugs in URLs)
- Circle-scoped AI insights
- Legacy game claiming (manually assigning old games to a circle)
- Guest-to-member conversion flow

## Open Questions

None — all decisions made during brainstorming and spec review.

## Next Steps

→ Implementation planning. Decompose into phases:
1. Clerk org infrastructure (middleware, provider, localization, first-run gate)
2. Schema migration (organizationId on Game + GuestUser)
3. Game creation with circle members (replace friend picker with Clerk membership)
4. Games list + query scoping to active circle
5. Guest users become circle-owned
6. Custom first-run setup flow with friend migration
7. Friend system removal
8. Legacy games archive page
9. Access control enforcement (circle membership checks on write operations)
