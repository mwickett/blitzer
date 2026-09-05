import type { Instrumentation } from "next";
import { sanitizeAnalyticsUrl } from "@/lib/analytics";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(error, {
    path: sanitizeAnalyticsUrl(request.path),
    method: request.method,
    // Referer and Next's routing headers can contain invitation tokens even
    // when the visible request path is sanitized. Route context is sufficient.
    headers: {},
  }, context);
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { default: PostHogClient } = await import("./app/posthog");
  try {
    await PostHogClient().captureExceptionImmediate(error, undefined, {
      errorSource: "server",
      // Next's route pattern preserves error context without join tokens or
      // query-string values from the request URL.
      path: context.routePath,
      method: request.method,
      routeType: context.routeType,
      routerKind: context.routerKind,
    });
  } catch {
    console.warn("Exception analytics delivery failed");
  }
};
