// Next 16 with Turbopack only bundles browser instrumentation from this file;
// a root sentry.client.config.ts is never loaded.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

import * as Sentry from "@sentry/nextjs";
import { sanitizeAnalyticsUrl } from "@/lib/analytics";

Sentry.init({
  dsn: "https://1de6afaad74a11eed2548e79e65170bd@o87852.ingest.us.sentry.io/4507369955459072",

  // Sample all traces in development, 10% in production to control quota
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,

  debug: false,

  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  beforeSend(event) {
    // Don't send errors in development
    if (process.env.NODE_ENV === "development") {
      return null;
    }

    // Invitation links carry join tokens; keep only the route.
    if (event.request?.url) {
      event.request.url = sanitizeAnalyticsUrl(event.request.url);
    }

    // Add React error boundary context if available
    const componentStack = event.extra?.componentStack;
    if (event.exception && componentStack) {
      event.exception.values = event.exception.values?.map((value) => ({
        ...value,
        value: `${value.value}\nReact Component Stack: ${componentStack}\n`,
      }));
    }

    return event;
  },

  beforeBreadcrumb(breadcrumb) {
    const data = breadcrumb.data;
    if (data) {
      for (const key of ["url", "from", "to"]) {
        if (typeof data[key] === "string") {
          data[key] = sanitizeAnalyticsUrl(data[key]);
        }
      }
    }
    return breadcrumb;
  },
});

// Replay is about 32 KB compressed, so it loads from Sentry's CDN once the
// page has loaded instead of joining every page's first-load bundle. If the
// CDN is blocked, errors are still reported without a replay.
function loadReplay() {
  Sentry.lazyLoadIntegration("replayIntegration")
    .then((replayIntegration) => {
      Sentry.addIntegration(
        replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      );
    })
    .catch(() => {});
}

if (document.readyState === "complete") {
  loadReplay();
} else {
  window.addEventListener("load", loadReplay, { once: true });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
