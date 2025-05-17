# Active Context

## Current Focus: Authentication Flows and Error Tracking

We've recently enhanced our authentication flows with comprehensive error tracking and improved user experience, especially for OAuth authentication.

### Authentication Flow Improvements

As of May 2025, we've implemented a standardized error tracking system for all authentication flows:

1. **New Error Tracking Utilities** (`src/lib/errorTracking.ts`):

   - `trackAuthError`: Captures authentication failures in both Sentry and PostHog
   - `trackAuthSuccess`: Records successful authentication events in PostHog

2. **Enhanced Authentication Components**:

   - `src/app/sign-in/[[...sign-in]]/page.tsx`: Email/password and Google OAuth sign-in
   - `src/app/sign-up/[[...sign-up]]/page.tsx`: Registration with email/password and Google OAuth
   - `src/app/sso-callback/page.tsx`: Handles OAuth redirect processing with specialized error detection
   - `src/app/complete-username/page.tsx`: Allows setting username after OAuth sign-up

3. **OAuth Flow Improvements**:

   - Enhanced error handling for OAuth callback processing
   - Added username completion step for OAuth sign-ups
   - URL parameter error detection in the SSO callback page

4. **Standardized Error Patterns**:

   - Consistent error tracking across all authentication components
   - User-friendly error messages based on error types
   - Detailed error context sent to monitoring platforms

5. **Documentation**:
   - Comprehensive documentation in `docs/auth-error-tracking.md`
   - Updated system patterns to reflect authentication patterns

## Active Decisions

The authentication enhancements preserve the existing auth functionality while adding better error handling and monitoring:

1. Error tracking includes auth flow type, method, and specific context
2. OAuth flows direct users to appropriate next steps (home or username completion)
3. Authentication errors are tracked with standardized formatting in both Sentry and PostHog
4. Success events are tracked to monitor conversion rates for each auth method

## Previous Focus: Code Organization and Maintainability

We previously worked on improving the organization of server-side code by breaking down large files into more manageable, domain-specific modules.

### Server Mutations Refactoring (March 29, 2025)

We refactored the `src/server/mutations.ts` file, which had grown too large and was becoming difficult to maintain. We split it into domain-specific files:

- `src/server/mutations/common.ts`: Shared utility functions for authentication and error handling
- `src/server/mutations/games.ts`: Game management functions
- `src/server/mutations/rounds.ts`: Round/score management functions
- `src/server/mutations/friends.ts`: Friend management functions
- `src/server/mutations/guests.ts`: Guest user management functions
- `src/server/mutations/index.ts`: Barrel file for tests

## Next Steps

1. Complete any testing to ensure the auth flows are working as expected
2. Monitor authentication errors in Sentry and PostHog to identify patterns
3. Consider applying a similar error tracking pattern to other critical user flows
4. Apply the server mutation refactoring pattern to other large files like `src/server/queries.ts`
