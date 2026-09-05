# Repository guidance

Blitzer is a Dutch Blitz scoring app built with Next.js App Router, React, TypeScript, Clerk, and PostgreSQL/Prisma. [README.md](README.md) describes setup and the current product contracts. Historical plans in `docs/superpowers` may describe removed flows; verify live callers before treating them as implementation guidance.

## Commands

```bash
npm ci                         # Install locked dependencies and generate Prisma
npm run dev                    # Start Next with Turbopack
npm run typecheck
npm run lint
npm test -- --runInBand         # Jest source tests
npm run test:integration        # Disposable PostgreSQL integration tests; Docker required
npx next build                 # Bundle check only; no migration or seeding
npm run build                  # Apply migrations to DATABASE_URL, then build
npm run vercel-build           # Generate Prisma, apply migrations, then build
npm run db:seed                # Explicit dev/preview fixtures; writes DB and Clerk
```

Use the Node versions declared in `package.json`. Copy `.env.example` to `.env` and fill in development settings; do not commit credentials, contact exports, or generated files. Jest's `src/` discovery excludes nested worktrees. Keep agent worktrees outside `src/` and browser artifacts in ignored directories.

## Code ownership and interfaces

- Import actions from `src/server/mutations/games`, `rounds`, or `lobbies` directly; no compatibility facades.
- `mutations/common.ts` owns `requireAuthContext("user" | "prismaId" | "org" | "orgWithPrismaId")` and `ensureCurrentPrismaUser`. The former verifies the requested identity/active-Circle context; the latter handles webhook races by provisioning from Clerk.
- `server/users/provision.ts` is the shared identity resolver for pickup actions and webhooks. Match immutable `clerk_user_id`, reject email collisions, preserve generated usernames on duplicate creation, and never relink a recreated identity by email.
- `server/scoring/access.ts` owns assertions for already-loaded games. `server/scoring/writeRound.ts` validates submissions and rechecks authorization inside the game-lock transaction. Keep score writes, revision checks, and completion reconciliation together.
- `lib/validation/submissions.ts` owns action schemas; `gameRules.ts` owns game rules and the shared TS/SQL score formula. `lib/gameLogic.ts` calculates final cumulative standings and deterministic winners from a small `ScoredGame` projection of the query-owned `GameDetail` shape. Participant display IDs have one field, `id`.
- `components/scoring/types.ts` owns the client score-entry and round DTOs. Scoring components share `RoundEditor` and `useScoringDraft`. Server success acknowledgements update local revisions; stale edits preserve the draft until the user chooses how to recover.
- Import queries from `server/queries/<domain>` directly. Games lists use `GameListPage` from `lib/gameList.ts`, not the full game detail graph. Keep page-size limits and filters in the database.
- `queries/playerStats.ts` provides shared bounded aggregate results. Started games and completed-game win-rate denominators must match across dashboard and Insights.
- Historical prediction queries are bounded per player and optional; worker forecasting is cancellable and cached. Keep it off the score-entry critical path.
- `components/RouteError.tsx` shares route error presentation, reset/navigation, and section telemetry. Root and component boundaries have their own lifecycles.

## Authentication and data model

`User` maps a Clerk identity to local score history. `GuestUser` is a non-authenticated participant added during game setup. `Game` is `CIRCLE`, `PICKUP`, or `LEGACY`; `GamePlayers`, `Round`, and `Score` store its roster and history.

Circle membership and invitations are managed by Clerk, with paginated membership reads in `server/clerkOrgs.ts`. Score mutations require a matching active Circle or membership in a started pickup game. Public game detail links are spectator views; write authorization must be enforced on the server. Unstarted pickup lobbies have a separate participant view. Legacy games are read-only.

The `OrganizationMembership` table and old guest invitation fields remain in the schema but have no active synchronization or application use. Dropping them requires a separate migration review. Deleted Clerk users remain stored to preserve game history; account retention remains a separate policy decision.

Clerk webhooks verify `CLERK_WEBHOOK_SIGNING_SECRET` using the SDK. Circle setup uses Clerk organizations; the legacy contact-import/invitation flow is retired. Do not restore contact exports, old guest-email invitation actions, or historical data migration prompts.

## Prisma and fixtures

- Schema: `src/server/db/schema.prisma`; config: `prisma.config.ts`.
- Generated Prisma 7 client: `src/generated/prisma/` (ignored). Import types from `@/generated/prisma/client`, not `@prisma/client`.
- Connections use `@prisma/adapter-pg`. Create additive migrations with `npx prisma migrate dev --name <change>` against an isolated database; never rewrite historical migrations.
- Integration tests create their own database and override inherited connection settings. Do not replace this runner with a shared database URL.
- Explicit fixture seeding preserves existing games, edits, guest names, added rounds, and rematches. It requires configured `SEED_*` values and a Clerk development key and may change development memberships. Builds must never seed.

## Analytics, flags, and Insights

The public PostHog project key (`NEXT_PUBLIC_POSTHOG_KEY`) is intentionally public; other secrets remain sensitive. Use snake_case event names and keep names, emails, IPs, join tokens, subjects, and chat contents out of analytics event properties.

Use `captureServerEvent` for server product events. It schedules `captureImmediate` within Next's `after` lifetime and contains delivery failures. Do not shut down the shared client after each request or let analytics failures fail committed actions. Email recipients/content belong only in the provider request; email telemetry records counts, categories, and results. Provider idempotency is not a durable outbox.

Client pageviews must wait for loaded Clerk identity/profile state and synchronize identify/reset before capture. Use `identify(userId)` without profile traits. Email and username are feature-flag evaluation overrides only. URL sanitization covers event envelopes, session-entry properties, and replay URLs. Automatic initial referrer/campaign attribution is deliberately retired; the provider clears persisted initial-origin keys before flag requests. Retain the actual-SDK regression when changing PostHog configuration or upgrading its SDK.

`llm-features` gates the nav, Insights UI, and `/api/chat`; only boolean `true` enables it. Server flags use a 60-second, 1,000-user cache with failed-entry eviction. Clerk email/username targeting works on both server and client. See `src/FEATURE_FLAGS.md`.

Chat uses AI SDK UI messages, server-side input limits/system prompt, and `gpt-3.5-turbo` through `@ai-sdk/openai`. Its context is the caller's aggregate statistics; no runtime SQL/analytics tools exist. `@posthog/ai` tracing uses privacy mode and immediate capture. Future tool-based plans must adapt to the current aggregate/query boundaries rather than restore the retired read-only client.

Sentry instrumentation receives Next's real request-error context. Preserve route-pattern attribution.

## Working style

Keep changes scoped to the request. Verify runtime consumers before retaining compatibility aliases or deleting code. Prefer existing domain functions and small DTOs over another layer. Update supported-interface tests when removing dead wrappers; preserve regression coverage for authorization, conflicts, retries, and data contracts.

Use mocked service boundaries for unit tests and synthetic local fixtures for database/browser verification. Real Clerk, email, and production database writes require the user's authorization. Do not infer authorization from an old plan or fixture script.
