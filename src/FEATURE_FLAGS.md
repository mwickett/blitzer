# Feature flags

Blitzer uses PostHog's `llm-features` flag for the Insights navigation link, page UI, and `/api/chat` authorization. A flag must resolve to boolean `true`. Missing values, string variants, and evaluation failures leave the feature disabled.

Configure flags in the PostHog project used by `NEXT_PUBLIC_POSTHOG_KEY`. Server evaluation uses `NEXT_PUBLIC_POSTHOG_HOST` (default US ingest); browser requests use the `/ingest` proxy configured in `next.config.mjs`.

## Server

```tsx
import { isFeatureEnabled } from "@/featureFlags";

const enabled = await isFeatureEnabled("llm-features");
```

The helper verifies Clerk authentication, then caches each user's flag set for 60 seconds. Concurrent requests share the fetch; failed entries are evicted, and the cache holds at most 1,000 users. Server routes must enforce the flag themselves even when the navigation link is hidden.

## Client

```tsx
"use client";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

export function Feature() {
  const enabled = useFeatureFlag("llm-features");
  return enabled ? <p>Enabled</p> : null;
}
```

Client evaluation also requires a signed-in user. `PostHogPageView` waits for the matching Clerk profile, synchronizes the analytics identity, and refreshes targeting when email/username change. These values are evaluation overrides only; they are not identify-event traits. Server evaluation passes the same targeting properties explicitly.

Initial campaign/referrer attribution is disabled and old persisted origin values are cleared because flag requests bypass event sanitization. Sanitized pageviews remain available. Preserve the real-SDK privacy regression when upgrading PostHog.
