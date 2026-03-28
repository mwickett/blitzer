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

### Shared DB Compatibility Policy

The shared dev/preview DB tracks the latest migrated branch. This is an accepted constraint:

- Schema changes are applied locally via `prisma migrate dev` before being deployed to previews.
- Older preview deployments are not guaranteed to remain functional after a schema-changing deploy.
- Schema changes should be additive when possible; destructive changes may invalidate older previews and local branches.
- If a preview looks broken after another branch landed migrations, redeploy it against the current schema.

## Clerk Dev Instance Prerequisites

The seed script automates membership setup, but these must exist in Clerk beforehand:
- **3 organizations**
- **3+ test users** (including the anchor user)

### Configuration via Environment Variables

Org and user references are configured explicitly via env vars rather than derived from API ordering. This prevents silent drift if Clerk-side orgs are deleted/recreated or accounts are cleaned up.

```
SEED_ORG_A=org_...         # Primary org — gets most game data
SEED_ORG_B=org_...         # Secondary org — gets 1 completed game
SEED_ORG_C=org_...         # Empty org — tests onboarding state
SEED_ANCHOR_USER=user_...  # Clerk user ID for mwickett-dev
SEED_USER_2=user_...       # Clerk user ID for second test player
SEED_USER_3=user_...       # Clerk user ID for third test player
```

The seed script validates that all six IDs exist in Clerk before proceeding. If any are missing or invalid, the script fails with a clear error message.

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
2. **Validate config**: Confirm `SEED_ORG_A`, `SEED_ORG_B`, `SEED_ORG_C`, and `SEED_ANCHOR_USER` are set and exist in Clerk
3. **Sync Clerk users**: Upsert User records from Clerk dev API (existing behavior)
4. **Reconcile Clerk org memberships** (Clerk API calls — additive and idempotent):
   - List members of each org
   - Ensure the anchor user is a member of all 3 orgs
   - Ensure at least 2 other test users are members of Org A
   - Ensure at least 1 other test user is a member of Org B
   - Create missing memberships via `organizations.createOrganizationMembership()` (direct add, no invitation flow)
   - Does NOT delete extra memberships — only ensures the minimum baseline. Ad-hoc testing in Clerk is preserved.
5. **Delete-and-recreate game data in a single transaction**:
   - All DB-side seed writes (delete old seed rows + create new ones) happen inside a Prisma `$transaction`
   - If any step fails, the transaction rolls back — the shared DB is never left in a partially-seeded state
   - Clerk mutations (step 4) run before the transaction since they are additive/idempotent and independent of DB state
   - Within the transaction:
     - Delete all existing seed records by deterministic IDs (scores → rounds → game players → games → guest users, respecting FK order)
     - Create GuestUsers: 2 guests in Org A, 1 guest in Org B, owned by the anchor user
     - Create Games (org-scoped):
       - **Org A** (3 games): 2 completed (one with 3 real players, one with 4 including a guest), 1 in-progress (a few rounds played, no winner yet)
       - **Org B** (1 game): 1 completed game with 2 real players and 1 guest
       - **Org C**: No seed data (tests empty/onboarding state)
     - Create Rounds & Scores: Realistic score distributions per round. Completed games have a winner who crossed `winThreshold` (75). Scores use actual Dutch Blitz values (`totalCardsPlayed` and `blitzPileRemaining`).

### Prisma Client Usage

The script will be refactored from raw `pg` queries to use the **Prisma client**. This provides:
- Type safety against the schema (compile-time errors on drift)
- No risk of raw SQL silently breaking after schema changes
- Cleaner code for the more complex game data creation
- `$transaction` support for atomic delete-and-recreate

### Idempotency Strategy

- **Clerk users**: Upsert on `clerk_user_id` (existing behavior, now via Prisma `upsert`)
- **Clerk memberships**: Additive only — create if missing, never delete
- **Game data**: Delete-and-recreate in a single transaction using deterministic UUIDs. All seed records use known IDs. On each run, delete all records with those IDs within a transaction, then recreate. Rollback on failure prevents partial state.

## Vercel Configuration

- Set the dev branch `DATABASE_URL` in Vercel's **Preview** environment settings
- Set `SEED_ORG_A`, `SEED_ORG_B`, `SEED_ORG_C`, `SEED_ANCHOR_USER`, `SEED_USER_2`, `SEED_USER_3`, and `SEED_PROD_DB_HOST` in Vercel's **Preview** environment
- The existing `vercel-build` script (`prisma generate && prisma migrate deploy && tsx prisma/seed.ts && next build`) requires no changes
- Prod environment keeps its own `DATABASE_URL`; seed script guards prevent execution

## Out of Scope

- **OrganizationMembership Prisma model seeding** — model is never queried, not worth maintaining
- **FriendRequest/Friend seeding** — these flows work through Clerk orgs now
- **Neon branching automation** — the dev branch is created once manually
- **Changes to the prod environment** — this is entirely a dev/preview concern
- **Deleting extra Clerk memberships** — seed only ensures minimums, doesn't undo manual testing
