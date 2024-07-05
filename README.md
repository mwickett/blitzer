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

You'll need [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed for local development.

First, run `docker-compose up -d` to start your local postgres container.

_Note:_ If this is the first time, you'll need to run `npx prisma migrate dev` to get the database initalized, migrated and seeded. You'll only need to run this command the first time (or if you ever delete the docker container)

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Test user

You can login to Clerk development by using the following credentials:

- User: alice@dutchblitz.io
- pass: eeX@pzZsGrHQXT3

You _can_ also create new users by signing up, but you'll need to be exposing a local API route to the internet so that Clerk's webhook can fire with the user update. Details on this are [available here](https://ngrok.com/docs/integrations/clerk/webhooks/)

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
