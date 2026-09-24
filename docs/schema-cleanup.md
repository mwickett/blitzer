# Schema cleanup — decision not to drop

**Date:** 2026-09-24  
**Verdict:** **Do not ship a destructive migration** yet. Keep the unused `OrganizationMembership` table and guest invitation columns until an owner inventories production data and explicitly approves the drop.

Related context: Slack/contact ops cleanup is a separate track (see open checklist PR if present); this doc only covers schema leftovers (pick-up option 8).

## What was reviewed

| Leftover | Location | Live app use? |
| --- | --- | --- |
| `OrganizationMembership` model/table | `src/server/db/schema.prisma`, migration `20251018000000_add_organizations` | **None.** No `prisma.organizationMembership` reads/writes under `src/` or tests. Clerk SDK `getOrganizationMembershipList` / `createOrganizationMembership` are **Clerk APIs**, not this table. |
| `GuestUser.invitationSent` | schema + guest migration | **None** in mutations/queries. Defaults only. |
| `GuestUser.invitationSentAt` | same | **None.** |
| `GuestUser.emailSent` | same | **None** in app code. |

Guest creates in `mutations/games.ts` and `mutations/lobbies.ts` only set `name`, `createdById`, and (circle) `organizationId`. Seed uses Clerk membership APIs, not the Prisma membership table.

The only test write of invitation columns is `tests/integration/gameList.test.ts`, which sets private fixture values so the game-list DTO serialization assert can prove those strings do not leak. That is a privacy canary, not product use.

## Why not drop yet

App callers are clean, but a drop remains **uncertain** without an owner inventory:

1. **Production data unknown** — No count/sample of non-null `emailSent` or leftover membership rows in prod/preview.
2. **External readers unknown** — Only the Blitzer app tree was grepped; BI or ad-hoc SQL could still select these columns.
3. **Destructive for values** — Dropping columns/table loses historical invitation metadata; restoring schema does not restore data.
4. **Process** — README/`CLAUDE.md` already require a separate migration review for these leftovers.

## When an owner wants the drop

1. Read-only inventory on the target DB (counts + samples).
2. Optionally export anything worth keeping.
3. Additive Prisma migration only (never rewrite historical migrations): drop the three `GuestUser` columns and the `OrganizationMembership` table; remove the `User.OrganizationMembership` relation.
4. Retarget the privacy canary in `tests/integration/gameList.test.ts` if those columns are gone.
5. Run typecheck, unit tests, and disposable-DB integration tests.

## Out of scope

- Restoring contact import / guest-email invitation flows
- Rewriting git history for deleted contact-export artifacts
- Dropping `GuestUser.organizationId` (still written for circle guests)
