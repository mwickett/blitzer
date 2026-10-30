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
// CDN is blocked, errors are still reported without a replay.
//
// Replay records the page URL in places no hook reaches (its URL list and
// rrweb's page metadata), so it only runs while the URL has no join token,
// query string or fragment, and stops before navigating to one that does.
type ReplayIntegration = ReturnType<
  Awaited<ReturnType<typeof Sentry.lazyLoadIntegration>>
> & { stop?: () => Promise<void> };
let replay: ReplayIntegration | undefined;

function isPrivateUrl(url: URL) {
  return url.pathname.startsWith("/join/") || url.search !== "" || url.hash !== "";
}

function loadReplay() {
  if (isPrivateUrl(new URL(window.location.href))) return;
  Sentry.lazyLoadIntegration("replayIntegration")
    .then((replayIntegration) => {
      if (replay || isPrivateUrl(new URL(window.location.href))) return;
      replay = replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        // Navigation and network entries are custom (type 5) events.
        beforeAddRecordingEvent: (event: object) =>
          JSON.parse(scrubUrls(JSON.stringify(event))),
      });
      Sentry.addIntegration(replay);
    })
    .catch(() => {});
}

if (document.readyState === "complete") {
  loadReplay();
} else {
  window.addEventListener("load", loadReplay, { once: true });
}

export function onRouterTransitionStart(href: string, navigationType: string) {
  if (replay && isPrivateUrl(new URL(href, window.location.href))) {
    void replay.stop?.();
    replay = undefined;
  }
  Sentry.captureRouterTransitionStart(href, navigationType);
}
