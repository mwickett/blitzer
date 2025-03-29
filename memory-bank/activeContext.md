# Active Context

## Current Focus: Code Organization and Maintainability

We've been working on improving the organization of server-side code by breaking down large files into more manageable, domain-specific modules.

### Recent Refactoring: Server Mutations

As of March 29, 2025, we refactored the `src/server/mutations.ts` file, which had grown too large and was becoming difficult to maintain. We split it into domain-specific files:

- `src/server/mutations/common.ts`: Shared utility functions for authentication and error handling
- `src/server/mutations/games.ts`: Game management (createGame, updateGameAsFinished, cloneGame)
- `src/server/mutations/rounds.ts`: Round/score management (createRoundForGame, updateRoundScores)
- `src/server/mutations/friends.ts`: Friend management (createFriendRequest, acceptFriendRequest, rejectFriendRequest)
- `src/server/mutations/guests.ts`: Guest user management (createGuestUser, getMyGuestUsers, inviteGuestUser)
- `src/server/mutations/index.ts`: Barrel file that re-exports all mutations (used primarily by tests)

The original `mutations.ts` file now explicitly re-exports each function from the new structure to maintain backward compatibility with existing imports. We discovered that Next.js "use server" directives have specific requirements:

1. Files with "use server" can only export async functions
2. You cannot use `export * from` in a "use server" file
3. Each function must be individually imported and re-exported

This approach:

1. Improves maintainability by grouping related functions
2. Makes the codebase easier to navigate
3. Preserves backward compatibility via explicit re-exports
4. Creates logical boundaries between different domains
5. Complies with Next.js "use server" restrictions

## Active Decisions

The refactoring preserves the existing behavior of all server actions while making them more maintainable. For proper backward compatibility, we:

1. Keep the "use server" directive on each domain-specific file
2. Remove it from the barrel index.ts file (used by tests)
3. Add it to the main mutations.ts file with explicit re-exports

Tests pass successfully and the app functions as expected with this structure.

## Next Steps

1. Apply a similar refactoring pattern to other large files like `src/server/queries.ts`
2. Document this export pattern in the shared team documentation
3. Consider adding more specific error handling in each domain module
