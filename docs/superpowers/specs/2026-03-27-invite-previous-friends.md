---
date: 2026-03-27
topic: invite-previous-friends
---

# Invite Previous Friends to Circles

## What We're Building

A flow that shows users their previous Blitzer friends (from before the Circles migration) and lets them invite those friends to their active circle with a single tap per person. Two entry points: automatic redirect after circle creation, and a persistent dashboard banner.

## Why

The Circles migration removed the friend system. Users who had friends now have empty circles with no obvious way to reconnect. The Clerk OrganizationSwitcher has invite functionality buried in settings. This feature surfaces the right people at the right time.

## Data Source

A static JSON file (`src/data/legacy-friends.json`) extracted from the production Neon restore branch (`pre-circles-restore`). Keyed by production Clerk user ID, each entry is an array of `{ username, email }` objects representing that user's previous friends.

- 20 users with friend data
- 58 friend entries (bidirectional)
- No runtime database query needed — the file ships with the app
- The Friend tables no longer exist in production

## Flow

### Entry Point A: Post-Circle Creation

1. User creates a circle on `/circles/setup`
2. `CircleSetup.tsx` redirects to `/circles/invite-friends` instead of `/dashboard`
3. User sees their previous friends list with invite buttons
4. User taps to invite, or clicks "Skip" / "Done" to go to dashboard

### Entry Point B: Dashboard Banner

1. User lands on `/dashboard`
2. Server component checks if current user has entries in the legacy friend map
3. If yes, and the banner hasn't been dismissed, show a banner: "You have N previous Blitzer friends not in this circle. [Invite] [Dismiss]"
4. "Invite" links to `/circles/invite-friends`
5. "Dismiss" hides the banner (stored in localStorage keyed by `clerkUserId:orgId`)

### The Invite Page (`/circles/invite-friends`)

Server component:
1. Read legacy friend map for the current user's Clerk ID
2. Fetch current circle members via Clerk API
3. Filter out friends who are already circle members
4. Pass the filtered list to the client component

Client component (`InviteFriends.tsx`):
1. Render each friend as a row: avatar initials, username, truncated email, "Invite" button
2. On tap: call `inviteFriendToCircle(email)` server action
3. On success: swap button to green checkmark + "Invited" label
4. On error: show error badge (Clerk handles duplicates as no-ops)
5. "Done" button navigates to `/dashboard`
6. If no friends to show (all already invited or user not in map): show empty state with link to dashboard

## Server Action

`inviteFriendToCircle(email: string)` in `src/server/mutations/circles.ts`:
- Gets `userId` and `orgId` from `auth()`
- Calls `clerkClient().organizations.createOrganizationInvitation()` with `role: "org:member"`
- Returns `{ success: true }` or `{ success: false, error: string }`
- Tracks `invite_friend_to_circle` event in PostHog

## Banner Dismissal

Client-side only. `localStorage` key: `blitzer:invite-banner-dismissed:${clerkUserId}:${orgId}`. The banner component checks this on mount. When dismissed, sets the key to `"true"`. Per-circle dismissal so switching circles can re-show the banner if relevant.

## Access Control

- `/circles/invite-friends` requires authentication + active circle (middleware already enforces this)
- The invite server action requires `auth().orgId` before sending invitations

## Scope

**In scope:**
- Static legacy friend map (JSON file)
- `/circles/invite-friends` page with tap-to-invite UI
- `inviteFriendToCircle` server action
- Dashboard banner with dismiss
- Post-creation redirect from CircleSetup
- PostHog tracking on invites

**Out of scope:**
- Freeform "invite by email" (Clerk's OrganizationSwitcher already has this)
- Real-time membership sync on the invite page (page-load check is sufficient)
- Automatic removal of the legacy friend map after migration period
- Server-side banner dismissal tracking
