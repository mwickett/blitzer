# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Blitzer is a companion web app for Dutch Blitz card game players to track scores and analyze gameplay statistics. Built with Next.js, it features user authentication, friend connections, score tracking, and statistical analysis.

## Essential Commands

```bash
# Development
npm run dev                  # Start development server with turbopack
npm install                  # Install dependencies

# Testing
npm test                     # Run Jest tests
npm run test:watch           # Run tests in watch mode
npm run test:coverage        # Run tests with coverage report

# Database
npx prisma migrate dev       # Create and apply migration (after schema changes)
npx prisma studio           # Open database viewer
npx prisma generate          # Generate Prisma client

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

**Database**: PostgreSQL via Neon, managed through Prisma ORM
- Schema: `src/server/db/schema.prisma`
- Always run `npx prisma migrate dev` after schema changes

**Authentication**: Clerk handles auth, user data synced via webhooks

**Feature Flags**: PostHog-based system
- Server: `isFeatureEnabled()` from `src/featureFlags.ts`
- Client: `useFeatureFlag()` from `src/hooks/useFeatureFlag.ts`
- Current flags documented in `src/FEATURE_FLAGS.md`

**Analytics & Error Tracking**: 
- PostHog for analytics and feature flags
- Sentry for error monitoring
- All server actions include PostHog event tracking

**Testing**: Jest with Testing Library, configured for Next.js App Router

## Development Workflow

1. **Schema Changes**: Modify `src/server/db/schema.prisma` → Run `npx prisma migrate dev`
2. **Server Actions**: Add to appropriate domain file in `src/server/mutations/`
3. **Components**: Use existing ShadCN UI components from `src/components/ui/`
4. **Authentication**: Always authenticate server actions before data operations
5. **Error Handling**: Wrap complex components in ErrorBoundary when appropriate

## Test Environment

- Test user credentials: alice@dutchblitz.io / eeX@pzZsGrHQXT3
- Use `npm test` for unit tests, `npm run test:watch` for development
- Database operations require test database setup via environment variables