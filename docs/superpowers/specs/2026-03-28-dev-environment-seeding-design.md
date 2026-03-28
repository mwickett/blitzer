# Dev Environment Seeding — Design Spec

## Problem

Local dev and Vercel deploy previews use the Clerk dev instance, which has different `clerk_user_id` values than production. The current Neon database branch was forked from prod, so it has prod Clerk IDs. When you sign in locally via Clerk dev, no matching User record exists — can't create games, can't test.

## Solution Overview

1. Create a fresh Neon dev branch (empty, not forked from prod)
2. Expand the existing `prisma/seed.ts` to sync Clerk dev users, reconcile org memberships, and create sample game data
3. Use the same Neon dev branch for both local dev and Vercel deploy previews
4. Script is idempotent (safe to re-run)

## Neon Branch Setup

- Create a fresh Neon dev branch via the Neon console (not forked from prod)
- Run `npx prisma migrate dev` against it to apply the schema from scratch
- This becomes the shared dev/preview database
- Env var changes:
  - `.env` gets the new dev branch `DATABASE_URL`
  - Vercel **Preview** environment gets the same dev branch URL
  - Vercel **Production** environment keeps the prod URL (no change)

## Clerk Dev Instance Prerequisites

The seed script automates membership setup, but these must exist in Clerk beforehand:
- **3 organizations** (assigned as Org A, B, C by creation date sort)
- **3+ test users** (including `mwickett-dev` as the anchor user)

The seed script handles everything else (membership assignment, database records, game data).

## Seed Script Design

### Location & Entry Point

Expand the existing `prisma/seed.ts`. Single file, single `npm run db:seed` command.

### Production Safety Guards (Two-Layer)

1. **VERCEL_ENV check**: Skip if `VERCEL_ENV === "production"` (existing guard, covers Vercel deploys)
2. **DATABASE_URL hostname check**: Reject if the URL matches the known prod Neon endpoint hostname. This catches local runs where `.env` accidentally has a prod URL, and non-Vercel CI environments.

Both guards must pass for the script to proceed.

### Error Handling

- **Local runs** (`VERCEL_ENV` not set): Fail hard on errors — throw so broken seed state is immediately visible
- **Vercel preview builds** (`VERCEL_ENV` is set and not `"production"`): Swallow errors and log, so seed failures don't block deploys (existing behavior)

### Execution Flow

1. **Guard**: Two-layer production safety check
2. **Sync Clerk users**: Upsert User records from Clerk dev API (existing behavior)
3. **Reconcile Clerk org memberships**:
   - List all orgs via Clerk API, sort by creation date → assign as Org A, B, C
   - List members of each org
   - Ensure `mwickett-dev` is a member of all 3 orgs
   - Ensure at least 2 other test users are members of Org A
   - Ensure at least 1 other test user is a member of Org B
   - Create missing memberships via `organizations.createOrganizationMembership()` (direct add, no invitation flow)
   - Does NOT delete extra memberships — only ensures the minimum baseline. Ad-hoc testing in Clerk is preserved.
4. **Delete-and-recreate game data**: Remove all seed game data (games, rounds, scores, guest users) by deterministic IDs, then recreate from scratch. This prevents relational data drift across seed fixture changes.
5. **Create GuestUsers**: 2 guests in Org A, 1 guest in Org B, owned by `mwickett-dev`
6. **Create Games** (org-scoped):
   - **Org A** (3 games): 2 completed (one with 3 real players, one with 4 including a guest), 1 in-progress (a few rounds played, no winner yet)
   - **Org B** (1 game): 1 completed game with 2 real players and 1 guest
   - **Org C**: No seed data (tests empty/onboarding state)
7. **Create Rounds & Scores**: Realistic score distributions per round. Completed games have a winner who crossed `winThreshold` (75). Scores use actual Dutch Blitz values (`totalCardsPlayed` and `blitzPileRemaining`).

### Prisma Client Usage

The script will be refactored from raw `pg` queries to use the **Prisma client**. This provides:
- Type safety against the schema (compile-time errors on drift)
- No risk of raw SQL silently breaking after schema changes
- Cleaner code for the more complex game data creation

### Idempotency Strategy

- **Clerk users**: Upsert on `clerk_user_id` (existing behavior, now via Prisma `upsert`)
- **Clerk memberships**: Additive only — create if missing, never delete
- **Game data**: Delete-and-recreate using deterministic UUIDs. All seed records (games, rounds, scores, guest users) use known IDs. On each run, delete all records with those IDs, then recreate. Clean slate prevents orphaned child rows from accumulating.

## Vercel Configuration

- Set the dev branch `DATABASE_URL` in Vercel's **Preview** environment settings
- The existing `vercel-build` script (`prisma generate && prisma migrate deploy && tsx prisma/seed.ts && next build`) requires no changes
- Prod environment keeps its own `DATABASE_URL`; seed script guards prevent execution

## Out of Scope

- **OrganizationMembership Prisma model seeding** — model is never queried, not worth maintaining
- **FriendRequest/Friend seeding** — these flows work through Clerk orgs now
- **Neon branching automation** — the dev branch is created once manually
- **Changes to the prod environment** — this is entirely a dev/preview concern
- **Deleting extra Clerk memberships** — seed only ensures minimums, doesn't undo manual testing
