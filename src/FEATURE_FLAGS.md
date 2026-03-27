# Feature Flags with PostHog

Blitzer uses PostHog for feature flags. This document explains how to use feature flags in the application.

## Current Active Flags

| Flag Key | Purpose | Where Used |
|----------|---------|------------|
| `llm-features` | Controls visibility of the Insights/LLM chat nav link | `NavBar.tsx` |

## Creating Feature Flags

Feature flags are managed in the PostHog dashboard:

1. Log in to the PostHog dashboard
2. Navigate to "Feature Flags" in the left sidebar
3. Click "New Feature Flag"
4. Enter a key (e.g., `my-feature`)
5. Configure rollout percentages and conditions
6. Save the feature flag

## Using Feature Flags

### In Server Components

```tsx
import { isFeatureEnabled } from "@/featureFlags";

export default async function MyServerComponent() {
  const myFeatureEnabled = await isFeatureEnabled("my-feature-key");
  return <div>{myFeatureEnabled && <MyFeature />}</div>;
}
```

### In Client Components

```tsx
"use client";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

export default function MyClientComponent() {
  const myFeatureEnabled = useFeatureFlag("my-feature-key");
  return <div>{myFeatureEnabled && <MyFeature />}</div>;
}
```

## Important Notes

- Feature flags are only evaluated for authenticated users
- The server-side implementation uses Clerk authentication to identify users
- The client-side implementation also respects authentication status
- PostHog's feature flags support percentage-based rollouts, user property targeting, and A/B testing variants
