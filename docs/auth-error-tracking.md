# Authentication Error Tracking

This document explains how authentication errors are tracked in the Blitzer application to provide better observability for troubleshooting authentication issues.

## Implementation Overview

We've implemented a comprehensive error tracking system for authentication flows that captures failures in both Sentry and PostHog. This allows us to:

1. Monitor authentication failure rates
2. Troubleshoot specific user authentication issues
3. Identify patterns in authentication problems
4. Track the success of our authentication flows

## Core Components

### Error Tracking Utilities

The system is built around a central utility file (`src/lib/errorTracking.ts`) that provides standardized error tracking functions:

```typescript
// Track errors in both Sentry and PostHog
export function trackAuthError(
  error: any,
  flow: AuthFlow,
  method: AuthMethod,
  context?: Record<string, any>
): string;

// Track successful authentication events in PostHog
export function trackAuthSuccess(
  flow: AuthFlow,
  method: AuthMethod,
  context?: Record<string, any>
): void;
```

### Tracked Authentication Flows

The following authentication flows are tracked:

- **Sign In** (`sign_in`)

  - Email/password sign-in
  - Google OAuth sign-in

- **Sign Up** (`sign_up`)

  - Email/password registration
  - Google OAuth sign-up

- **Verification** (`verification`)

  - Email verification codes

- **OAuth Callback** (`oauth_callback`)

  - OAuth redirect processing

- **Username Completion** (`username_completion`)
  - Required step after OAuth sign-up

### Tracked Authentication Methods

The following authentication methods are tracked:

- Email/password (`email_password`)
- Google OAuth (`oauth_google`)
- Email verification codes (`email_code`)

## Implementation Details

### Error Handling Pattern

Each authentication component follows this pattern for error handling:

```typescript
try {
  // Authentication operation
} catch (err) {
  // Log to console for debugging
  console.error("Auth error:", JSON.stringify(err, null, 2));

  // Track in Sentry and PostHog with standardized format
  const errorMessage = trackAuthError(
    err,
    "flow_type", // e.g., sign_in, sign_up
    "auth_method", // e.g., email_password, oauth_google
    {
      // Additional context
      step: "specific_operation",
      // Other non-sensitive information
    }
  );

  // Display user-friendly error
  setError(errorMessage);
}
```

### Success Tracking Pattern

Successful authentication events are tracked with:

```typescript
trackAuthSuccess(
  "flow_type", // e.g., sign_in, sign_up
  "auth_method", // e.g., email_password, oauth_google
  {
    status: "complete", // or other contextual information
  }
);
```

## Special Handling for OAuth

For OAuth flows, we've implemented additional error detection in the SSO callback page to capture errors that might occur during the redirect process:

- URL parameter error detection
- Custom error object creation
- Direct Sentry and PostHog tracking

## Error Data in Sentry

In Sentry, authentication errors include:

- **Tags**:

  - `auth_flow`: Identifies which flow had the error
  - `auth_method`: Identifies which authentication method failed

- **Extra Context**:
  - Error details (code, type, etc.)
  - Step in the authentication process
  - Other non-sensitive context data

## Error Data in PostHog

In PostHog, authentication errors are tracked as events named `auth_error` with properties:

- `auth_flow`: The authentication flow (sign_in, sign_up, etc.)
- `auth_method`: The authentication method (email_password, oauth_google, etc.)
- `error_message`: User-friendly error message
- `error_code`: Error code if available
- `error_type`: Error type category
- Additional context properties

## Success Events in PostHog

Successful authentication events are tracked as `auth_success` events with similar context properties.

## Testing and Verification

You can test the error tracking by:

1. Attempting to sign in with invalid credentials
2. Attempting to sign up with an existing email
3. Entering an invalid verification code
4. Causing OAuth errors (e.g., revoking permissions)

The errors will appear in both Sentry and PostHog dashboards for analysis.

## Recommended Dashboards

Consider creating the following dashboards:

### PostHog

- Authentication success rates over time
- Authentication errors by type and flow
- Most common authentication errors

### Sentry

- Authentication error alerts for unexpected spikes
- Saved queries for common authentication issues
