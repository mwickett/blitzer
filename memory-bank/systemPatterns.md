# System Patterns

This document describes the key architectural patterns and design decisions used throughout the project.

## Server Action Organization

### Domain-Based Modularization Pattern

As of March 2025, we've adopted a domain-based modularization pattern for server actions:

```
src/server/
├── mutations/              # Server actions that modify data
│   ├── index.ts            # Re-exports all mutations (used by tests)
│   ├── common.ts           # Shared utility functions
│   ├── games.ts            # Game-related mutations
│   ├── rounds.ts           # Round/score-related mutations
│   ├── friends.ts          # Friend-related mutations
│   └── guests.ts           # Guest user-related mutations
├── queries/                # (Proposed) Similar structure for queries
└── mutations.ts            # Re-exports all server actions with "use server" directive
```

#### Benefits of This Pattern

1. **Maintainability**: Smaller, focused files are easier to understand and modify
2. **Organization**: Functions are grouped by domain, making code more navigable
3. **Backward Compatibility**: The main file explicitly re-exports each function to maintain existing imports
4. **Testability**: Domain-specific files can be tested more easily
5. **Clear Boundaries**: Better separation of concerns between different domains

#### Next.js "use server" Re-export Pattern

Due to Next.js restrictions, when re-exporting server actions in a file with the "use server" directive:

```typescript
// src/server/mutations.ts
"use server";

// Must explicitly import and re-export each function
import { func1, func2 } from "./mutations/domain";
export { func1, func2 };

// Cannot use barrel pattern in "use server" files
// ❌ export * from "./mutations/index"; // This won't work
```

Each domain-specific file also has its own "use server" directive, but the index.ts barrel file does not.

#### Common Patterns in Server Actions

Most server actions follow this pattern:

1. Authentication check via `getAuthenticatedUser()` or `getAuthenticatedUserPrismaId()`
2. Data validation
3. Database operations with Prisma
4. Analytics tracking with PostHog
5. Error handling

## Authentication and Authorization

All server actions should start with authentication, using the common utility functions in `src/server/mutations/common.ts`:

```typescript
// Example usage
const { user, posthog } = await getAuthenticatedUser();

// Or when you need the internal Prisma ID
const { userId, id, posthog } = await getAuthenticatedUserPrismaId();
```

## Error Handling

Domain-specific errors are used to provide user-friendly error messages. For example, the `ValidationError` class in `src/lib/validation/gameRules.ts` is used for game rule validation.

## Analytics

PostHog is used for analytics tracking throughout the application. All server actions track relevant events using the PostHog client:

```typescript
posthog.capture({
  distinctId: user.userId,
  event: "event_name",
  properties: {
    /* relevant properties */
  },
});
```
