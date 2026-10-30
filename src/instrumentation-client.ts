// Next 16 with Turbopack only bundles browser instrumentation from this file;
// a root sentry.client.config.ts is never loaded.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

import * as Sentry from "@sentry/nextjs";

// Invitation links carry join tokens, and query strings can carry other
// values. Like analytics, Sentry keeps only the route of every URL it sends.
function scrubUrls(text: string) {
  return text
    .replace(/(\/join\/)[^/?#\s"'\\]+/g, "$1[token]")
    .replace(/[?#][^\s"'\\]*/g, "");
}

function scrubFields(fields: Record<string, unknown> | undefined) {
  if (!fields) return;
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string") fields[key] = scrubUrls(value);
  }
}

function scrubEventUrls<T extends Sentry.Event>(event: T) {
  if (event.transaction) event.transaction = scrubUrls(event.transaction);
  if (event.request?.url) event.request.url = scrubUrls(event.request.url);
  scrubFields(event.contexts?.trace?.data);
  return event;
}

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

    scrubEventUrls(event);

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

  beforeSendTransaction: scrubEventUrls,

  beforeSendSpan(span) {
    if (span.description) span.description = scrubUrls(span.description);
    scrubFields(span.data);
    return span;
  },

  beforeBreadcrumb(breadcrumb) {
    scrubFields(breadcrumb.data);
    return breadcrumb;
  },
});

// Replay is about 32 KB compressed, so it loads from Sentry's CDN once the
// page has loaded instead of joining every page's first-load bundle. If the
// CDN is blocked, errors are still reported without a replay. Sessions that
// start on an invitation link are not recorded, because a replay's URL list
// cannot be filtered.
function loadReplay() {
  if (window.location.pathname.startsWith("/join/")) return;
  Sentry.lazyLoadIntegration("replayIntegration")
    .then((replayIntegration) => {
      Sentry.addIntegration(
        replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
          // Page metadata (type 4) and navigation/network entries (type 5)
          // carry URLs; DOM snapshots are left alone.
          beforeAddRecordingEvent(event: { type: number }) {
            if (event.type === 4 || event.type === 5) {
              return JSON.parse(scrubUrls(JSON.stringify(event)));
            }
            return event;
          },
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
