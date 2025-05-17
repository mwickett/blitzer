import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

type AuthFlow =
  | "sign_in"
  | "sign_up"
  | "verification"
  | "oauth_callback"
  | "username_completion";
type AuthMethod = "email_password" | "oauth_google" | "email_code";

/**
 * Tracks authentication errors in both Sentry and PostHog
 *
 * @param error The error object from the catch block
 * @param flow The authentication flow where the error occurred (sign_in, sign_up, etc.)
 * @param method The authentication method being used (email_password, oauth_google, etc.)
 * @param context Additional context data to include (non-sensitive)
 * @returns The error message for UI display
 */
export function trackAuthError(
  error: any,
  flow: AuthFlow,
  method: AuthMethod,
  context?: Record<string, any>
): string {
  // Extract error details
  const errorObj = error?.errors?.[0] || {};
  const errorMessage = errorObj?.message || "Unknown authentication error";
  const errorCode = errorObj?.code;
  const errorType = errorObj?.type;

  // Clean context to remove sensitive data
  const safeContext = { ...context };

  // Track in Sentry
  Sentry.captureException(error, {
    tags: {
      auth_flow: flow,
      auth_method: method,
    },
    extra: {
      ...safeContext,
      errorCode,
      errorType,
    },
  });

  // Track in PostHog
  posthog.capture("auth_error", {
    auth_flow: flow,
    auth_method: method,
    error_message: errorMessage,
    error_code: errorCode,
    error_type: errorType,
    ...safeContext,
  });

  // Return the error message for UI display
  return errorMessage;
}

/**
 * Tracks successful authentication events in PostHog
 *
 * @param flow The authentication flow that succeeded
 * @param method The authentication method used
 * @param context Additional context data to include (non-sensitive)
 */
export function trackAuthSuccess(
  flow: AuthFlow,
  method: AuthMethod,
  context?: Record<string, any>
): void {
  // Track in PostHog only (success doesn't need Sentry)
  posthog.capture("auth_success", {
    auth_flow: flow,
    auth_method: method,
    ...context,
  });
}
