export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Type definitions for the onRequestError handler
type RequestError = Error;
type NextRequest = {
  headers: {
    cookie?: string;
  };
  url: string;
  method: string;
};
type RequestContext = Record<string, unknown>;

export const onRequestError = async (
  err: RequestError,
  request: NextRequest,
  context: RequestContext
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Sentry reporting (keep both for now)
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(err);

    // PostHog reporting
    const { default: PostHogClient } = await import("./app/posthog");
    const posthog = PostHogClient();

    let distinctId = null;
    if (request.headers.cookie) {
      const cookieString = request.headers.cookie;
      const postHogCookieMatch = cookieString.match(
        /ph_phc_.*?_posthog=([^;]+)/
      );

      if (postHogCookieMatch && postHogCookieMatch[1]) {
        try {
          const decodedCookie = decodeURIComponent(postHogCookieMatch[1]);
          const postHogData = JSON.parse(decodedCookie);
          distinctId = postHogData.distinct_id;
        } catch (e) {
          console.error("Error parsing PostHog cookie:", e);
        }
      }
    }

    // Add additional context to the error
    const properties = {
      errorSource: "server",
      path: request.url,
      method: request.method,
    };

    // Send to PostHog with user ID if available
    if (distinctId) {
      await posthog.capture({
        distinctId,
        event: "$exception",
        properties: {
          ...properties,
          exception: {
            name: err.name,
            message: err.message,
            stack: err.stack,
          },
        },
      });
    } else {
      // Pass error as first parameter and properties as second parameter
      await posthog.captureException(err);
    }
  }
};
