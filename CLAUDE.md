# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Blitzer is a companion web app for Dutch Blitz card game players to track scores and analyze gameplay statistics. Built with Next.js, it features user authentication, friend connections, score tracking, and statistical analysis.

## Essential Commands

```bash
# Development
npm run dev                  # Start development server with turbopack
npm install                  # Install dependencies (runs prisma generate via postinstall)

# Testing
npm test                     # Run Jest tests
npm run test:watch           # Run tests in watch mode
npm run test:coverage        # Run tests with coverage report

# Database
npx prisma migrate dev       # Create and apply migration (after schema changes)
npx prisma studio           # Open database viewer
npx prisma generate          # Generate Prisma client (to src/generated/prisma/)

# Build & Quality
npm run build               # Build for production (includes migrations)
npm run lint                # Run ESLint
```

## Architecture & Data Model

### Core Data Entities

- **User**: Authenticated users (via Clerk)
- **GuestUser**: Non-authenticated players created by registered users
- **Game**: A complete Dutch Blitz game session
- **Round**: Individual rounds within a game
- **Score**: Player scores for each round (totalCardsPlayed, blitzPileRemaining)
- **Friend/FriendRequest**: Social connections between users

### Key Patterns

**Server Actions Organization**: Domain-based modular structure in `src/server/mutations/`:

- `games.ts` - Game creation, updates, completion
- `rounds.ts` - Score entry and round management
- `friends.ts` - Friend requests and connections
- `guests.ts` - Guest user management

**Authentication Flow**: All server actions start with `getAuthenticatedUser()` or `getAuthenticatedUserPrismaId()` from `src/server/mutations/common.ts`

**Error Handling**: Multi-layered approach:

- Global error boundary: `src/app/global-error.tsx`
- Section-specific boundaries: `src/app/*/error.tsx`
- Component boundary: `src/components/ErrorBoundary.tsx`

## Key Technical Details

**Database**: PostgreSQL via Neon, managed through Prisma 7

- Schema: `src/server/db/schema.prisma`
- Config: `prisma.config.ts` (datasource URL, schema path, migrations path)
- Generated client: `src/generated/prisma/` (gitignored, regenerated on `npm install`)
- Import Prisma types from `@/generated/prisma/client`, not `@prisma/client`
- Uses `@prisma/adapter-pg` driver adapter for database connections
- Always run `npx prisma migrate dev` after schema changes

**Authentication**: Clerk handles auth, user data synced via webhooks

**Feature Flags**: PostHog-based system

- Server: `isFeatureEnabled()` from `src/featureFlags.ts`
- Client: `useFeatureFlag()` from `src/hooks/useFeatureFlag.ts`
- Active flag: `llm-features` (controls Insights nav link visibility)

**Analytics & Error Tracking**:

- PostHog for analytics and feature flags
- Sentry for error monitoring
- Server actions should include PostHog event tracking

**Testing**: Jest with Testing Library, configured for Next.js App Router

## Working Style

- When reviewing code or making changes, avoid excessive modifications beyond what was requested. Focus on the specific ask before suggesting broader refactors.
- When asked to review or explain the codebase, provide a concise summary first before diving into details. Do not generate report files or offer to write files unless explicitly asked.
- Only change what is requested. Flag issues but don't fix them unless asked.

## Analytics / PostHog

- PostHog is used for analytics and feature flags. The public PostHog project key exposed to the client (via `NEXT_PUBLIC_POSTHOG_KEY`) is intentionally public — do not flag it as a security issue. All other PostHog keys or secrets (personal API keys, server-side secrets) must be treated as sensitive.
- When adding tracking events, ensure no PII (emails, names, IPs) is included in event properties.
- Use consistent event naming conventions (snake_case) across both client-side and server-side API routes.
- Server actions should include PostHog event tracking — maintain this pattern when adding new actions.

## Development Workflow

1. **Schema Changes**: Modify `src/server/db/schema.prisma` → Run `npx prisma migrate dev`
2. **Server Actions**: Add to appropriate domain file in `src/server/mutations/`
3. **Components**: Use existing ShadCN UI components from `src/components/ui/`
4. **Authentication**: Always authenticate server actions before data operations
5. **Error Handling**: Wrap complex components in ErrorBoundary when appropriate

## Test Environment

- Test user credentials: ask the human developer to provide these for you.
- Use `npm test` for unit tests, `npm run test:watch` for development
- Database operations require test database setup via environment variables
