# Blitz

This is a project to build a web app for scoring the card game [Dutch Blitz](https://en.wikipedia.org/wiki/Dutch_Blitz). It's built using:

- [NextJS](https://nextjs.org/)
- [Vercel](https://vercel.com/)
- [Neon](https://neon.tech)
- [Prisma](https://www.prisma.io/)
- [Clerk](https://www.clerk.com) (for auth)
- [PostHog](https://posthog.com/) (for analytics)

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Background

This project is really about creating a wonderful personal data set of Dutch Blitz scores, so that you can see cool trends and just generally nerd out about it. It's not practically very useful at all, but it's an itch that myself, and some friends really wanted to scratch. And those kind of itches make for the best side projects, right?

## Getting Started

Ask a team member for a copy of the `.env` file (still need to get envs sorted out in Vercel)

You'll also need access to Neon to get a DB branch setup for your local development.

Once you've cloned the repo, run `npm install` to install dependencies.

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Verification

Run `npm run typecheck`, `npm run lint`, and `npm test -- --runInBand` for source checks.
Test discovery excludes nested agent worktrees.

`npm run test:integration` requires Docker. It creates an empty PostgreSQL 17 container
on a random loopback port, applies the complete migration history, runs the integration
tests, and removes the container. It always overrides `DATABASE_URL`; it never uses a
shared development or production database.

## Preview fixtures

Run `npm run db:seed` explicitly when initializing a development database. Configure
the `SEED_*` variables in `.env.example` and use a Clerk development key (`sk_test_`).
The command also synchronizes Clerk users and ensures the configured Circle memberships.
It preserves existing fixture games, edited scores, added rounds, and rematches. Existing
fixtures are never reset; use a fresh isolated database when a clean scenario is needed.
Failures exit nonzero, and production exits before reading preview configuration.

Vercel builds apply migrations and build the app; they do not seed data or modify Clerk
memberships. Historical seeding plans under `docs/superpowers` describe the former
delete-and-recreate behavior and are superseded by this workflow.

## Slack reports

The Slack `/whois` endpoint requires `SLACK_SIGNING_SECRET`, `SLACK_WHOIS_TEAM_ID`,
and a comma-separated `SLACK_WHOIS_USER_IDS` list of permitted operators. Configure
these before enabling the command; missing configuration denies access. Reports are
ephemeral and omit email addresses. Signed requests must be within five minutes of
server time, as described in [Slack's verification guide](https://docs.slack.dev/authentication/verifying-requests-from-slack/).

## Making schema changes / Using Prisma

If you make changes to the schema, you'll need to run `npx prisma migrate dev` to create and apply a migration to your local DB. You should ensure you commit those migration files so that they can be applied to production as well (this will happen automatically as part of the build).

You can also run `npx prisma studio` to spin up a nice little data viewer to inspect data in the DB.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
