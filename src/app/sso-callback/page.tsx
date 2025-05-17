"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { trackAuthError } from "@/lib/errorTracking";

export default function SSOCallbackPage() {
  // Track errors that might occur during the OAuth callback process
  useEffect(() => {
    // Check URL for error parameters that Clerk might add
    const url = new URL(window.location.href);
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      console.error("SSO callback error:", error, errorDescription);

      // Create an error object similar to Clerk's format for consistency
      const errorObj = {
        errors: [
          {
            message: errorDescription || `OAuth error: ${error}`,
            code: error,
            type: "oauth_callback_error",
          },
        ],
      };

      // Track the error
      trackAuthError(
        errorObj,
        "oauth_callback",
        "oauth_google", // Assuming Google as default, might need adjustment
        { callbackUrl: window.location.pathname }
      );

      // Additionally track directly to Sentry with more context
      Sentry.captureMessage(`OAuth callback error: ${error}`, {
        level: "error",
        tags: {
          auth_flow: "oauth_callback",
        },
        extra: {
          error_description: errorDescription,
          error_code: error,
          url: window.location.href,
        },
      });

      // Also track to PostHog directly
      posthog.capture("auth_error", {
        auth_flow: "oauth_callback",
        error_message: errorDescription || `OAuth error: ${error}`,
        error_code: error,
        error_type: "oauth_callback_error",
      });
    }
  }, []);

  // Handle the redirect flow by calling the Clerk.handleRedirectCallback() method
  // or rendering the prebuilt <AuthenticateWithRedirectCallback/> component.
  // This is the final step in the custom OAuth flow.
  return (
    <AuthenticateWithRedirectCallback
      continueSignUpUrl={"/complete-username"}
    />
  );
}
