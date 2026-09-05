# Blitzer

Blitzer tracks Dutch Blitz scores, game history, and player statistics. Play within a Circle (a Clerk organization), or start a pickup lobby that players join by link or code. Public game links let spectators follow the score.

The app uses Next.js 16 App Router, React 19, TypeScript, PostgreSQL with Prisma 7, and Clerk. PostHog provides analytics and feature flags, Sentry reports errors, and Resend delivers email. It deploys on Vercel with Neon PostgreSQL.

## Local setup

Use Node.js 20.20+ within the 20.x line, or 22.22+ (see `package.json`), npm, an isolated PostgreSQL database, and a Clerk development instance.

```bash
cp .env.example .env
# Fill in DATABASE_URL, Clerk development keys, and RESEND_API_KEY.
npm ci
npx prisma migrate deploy
npm run dev
```

Open [localhost:3000](http://localhost:3000). `npm ci` generates the Prisma client at `src/generated/prisma/`. Use a local database or an isolated Neon development branch; the migration command changes the configured database.

Configure Clerk's webhook endpoint at `/api/webhooks` for `user.created` and `user.updated`, with `CLERK_WEBHOOK_SIGNING_SECRET` from the endpoint settings. Provisioning uses the immutable Clerk user ID. Email collisions are rejected rather than transferring another account's history. Pickup signup also provisions locally so players can join before the webhook arrives. Deleted users remain stored for game history; recreating an account does not automatically recover that identity.

The email module requires `RESEND_API_KEY` at initialization; configure a development key for welcome and game-completion email. Insights additionally requires `OPENAI_API_KEY` and an enabled PostHog `llm-features` flag. Configure `NEXT_PUBLIC_APP_URL` to the correct origin for pickup invitation links. See [.env.example](.env.example) for optional PostHog, Slack, and seeding settings.

## Scoring and access

Circle scoring requires the user's active Clerk organization to match the game. Pickup scoring requires a registered participant and a started lobby; the host controls starting. Guests are added during game setup. Clerk handles Circle invitations and membership; there is no separate guest-email invitation flow. Legacy games are read-only.

Round creation and editing share one validated server write path. It locks the game, validates the exact roster and score limits, checks the expected round revision for edits, and recomputes completion from all recorded rounds. Duplicate successful submissions are idempotent; conflicting submissions preserve the existing scores. A historical correction can reopen a completed game without deleting later rounds.

The games list returns 20 display rows per page, with server-side filters and stable cursor pagination. Statistics use database aggregates; games played exclude unstarted pickup lobbies, and game win rate uses completed games with a recorded winner. Optional probability forecasts run in a worker, with bounded historical samples and caching; they do not block score entry.

Insights streams text through the AI SDK using `gpt-3.5-turbo` and the caller's aggregate statistics. The route enforces authentication and the feature flag, bounds request size and conversation history, and supplies its own system prompt. No database-query tools are registered. Older tool-based proposals under `docs/superpowers` are design history, not the runtime contract.

## Verification

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npm run test:integration
```

Jest discovers tests under `src/`, so nested agent worktrees are excluded. PostgreSQL integration tests require Docker: the runner creates a PostgreSQL 17 container on a random loopback port, overrides `DATABASE_URL`, applies the migration history, tests transactions/read models/fixtures, and removes the container. It never uses the configured development or production database.

CI also runs `npx next build` with synthetic initialization credentials. That build check does not run migrations or seed data. Browser verification still matters for auth hydration, Circle invitations, shared pickup scoring, historical edits, and mobile score entry.

## Preview fixtures

Run `npm run db:seed` explicitly to initialize a development or preview database. Configure every `SEED_*` variable in `.env.example` using your own Clerk development users and organizations, and use a `sk_test_` key. This command writes both the database and Clerk: it synchronizes development users, ensures Circle memberships, and adds missing fixture games.

Existing fixture games, edited scores, added rounds, guest names, and rematches are preserved. Use a fresh isolated database for a clean scenario. Production exits before reading fixture configuration; failures exit nonzero. Historical delete-and-recreate seeding plans are superseded by this workflow.

## Analytics and Slack

Server events use a shared PostHog client and `captureServerEvent`, which awaits immediate delivery inside Next's `after` lifetime. Analytics failure cannot turn a committed score into a failed action. Email delivery reports success/failure separately and uses provider idempotency keys; it is not a durable outbox.

Client pageviews wait for Clerk identity hydration and are deduplicated. Invitation tokens and query/hash values are stripped from analytics URL properties and replay URLs. Automatic initial referrer/campaign attribution is deliberately disabled, and older initial-origin values are cleared before flag requests. Email/username targeting traits are sent only as feature-flag evaluation overrides, not identify-event properties. LLM tracing uses privacy mode. Do not add names, emails, IP addresses, invitation tokens, or message contents to event properties.

`llm-features` requires literal boolean `true`; missing flags, variants, and failures deny access. Server flag results use a 60-second cache capped at 1,000 users. See [feature flag usage](src/FEATURE_FLAGS.md).

The Slack `/whois` endpoint requires `SLACK_SIGNING_SECRET`, one `SLACK_WHOIS_TEAM_ID`, and a comma-separated `SLACK_WHOIS_USER_IDS` operator list. Missing configuration denies access. Requests must have a valid signature and timestamp within five minutes. Reports are ephemeral and omit email addresses.

## Schema and deployment

Edit `src/server/db/schema.prisma`, then run `npx prisma migrate dev --name <change>` against an isolated database. Commit the additive migration and schema changes; do not edit historical migrations. `prisma.config.ts` owns the schema, migration, and datasource configuration. Import generated types from `@/generated/prisma/client`.

`npm run build` applies migrations to `DATABASE_URL` before building. `npm run vercel-build` also regenerates Prisma. Neither command seeds data or changes Clerk memberships. Configure Vercel environment variables for the intended database and Clerk instance before deploying.

Clerk is the source of Circle membership. The old `OrganizationMembership` table and guest invitation columns remain in the schema for a separately reviewed migration; the application does not synchronize or use them. The retired contact export and invitation migration must not be restored. Removing those files did not erase copies in historical commits or external artifacts.
