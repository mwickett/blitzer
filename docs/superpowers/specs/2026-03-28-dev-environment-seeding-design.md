# Dev Environment Seeding — Design Spec

## Problem

Local dev and Vercel deploy previews use the Clerk dev instance, which has different `clerk_user_id` values than production. The current Neon database branch was forked from prod, so it has prod Clerk IDs. When you sign in locally via Clerk dev, no matching User record exists — can't create games, can't test.

## Solution Overview

1. Create a fresh Neon dev branch (empty, not forked from prod)
2. Expand the existing `prisma/seed.ts` to sync Clerk dev users AND create sample game data
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

## Seed Script Design

### Location & Entry Point

Expand the existing `prisma/seed.ts`. Single file, single `npm run db:seed` command.

### Production Safety Guards (Two-Layer)

1. **VERCEL_ENV check**: Skip if `VERCEL_ENV === "production"` (existing guard, covers Vercel deploys)
2. **DATABASE_URL hostname check**: Reject if the URL matches the known prod Neon endpoint hostname. This catches local runs where `.env` accidentally has a prod URL, and non-Vercel CI environments.

Both guards must pass for the script to proceed.

### Execution Flow

1. **Guard**: Two-layer production safety check
2. **Sync Clerk users**: Upsert User records from Clerk dev API (existing behavior)
3. **Create GuestUsers**: 2-3 guest players, owned by the first seeded user
4. **Create Games**: 4 games with varied states:
   - 2 completed games (one with 3 players, one with 4 including a guest)
   - 1 in-progress game (a few rounds played, no winner yet)
   - 1 freshly created game (no rounds yet)
5. **Create Rounds & Scores**: Realistic score distributions per round. Completed games have a winner who crossed `winThreshold` (75). Scores use actual Dutch Blitz values (`totalCardsPlayed` and `blitzPileRemaining`).

### Prisma Client Usage

The script will be refactored from raw `pg` queries to use the **Prisma client**. This provides:
- Type safety against the schema (compile-time errors on drift)
- No risk of raw SQL silently breaking after schema changes
- Cleaner code for the more complex game data creation

### Idempotency Strategy

- **Clerk users**: Upsert on `clerk_user_id` (existing behavior, now via Prisma `upsert`)
- **Game data**: Use deterministic UUIDs for all seed records (games, rounds, scores, guest users). On re-run, Prisma's `upsert` with these known IDs ensures existing records are updated rather than duplicated

## Vercel Configuration

- Set the dev branch `DATABASE_URL` in Vercel's **Preview** environment settings
- The existing `vercel-build` script (`prisma generate && prisma migrate deploy && tsx prisma/seed.ts && next build`) requires no changes
- Prod environment keeps its own `DATABASE_URL`; seed script guards prevent execution

## Out of Scope

- **OrganizationMembership seeding** — model is never queried, not worth maintaining
- **FriendRequest/Friend seeding** — these flows work through Clerk orgs now
- **Neon branching automation** — the dev branch is created once manually
- **Changes to the prod environment** — this is entirely a dev/preview concern
