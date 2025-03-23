# Feature Flags with PostHog

Blitzer uses PostHog for feature flags. This document explains how to use feature flags in the application.

## Creating Feature Flags

Feature flags are managed in the PostHog dashboard:

1. Log in to the PostHog dashboard
2. Navigate to "Feature Flags" in the left sidebar
3. Click "New Feature Flag"
4. Enter a key (e.g., `score-charts`)
5. Configure rollout percentages and conditions
6. Save the feature flag

## Using Feature Flags

### In Server Components

```tsx
import { isFeatureEnabled, isScoreChartsEnabled } from "@/featureFlags";

export default async function MyServerComponent() {
  // Option 1: Use the generic function
  const myFeatureEnabled = await isFeatureEnabled("my-feature-key");

  // Option 2: Use a specific helper function (when available)
  const scoreChartsEnabled = await isScoreChartsEnabled();

  return <div>{scoreChartsEnabled && <ScoreCharts />}</div>;
}
```

### In Client Components

```tsx
"use client";
import { useFeatureFlag, useScoreChartsFlag } from "@/hooks/useFeatureFlag";

export default function MyClientComponent() {
  // Option 1: Use the generic hook
  const myFeatureEnabled = useFeatureFlag("my-feature-key");

  // Option 2: Use a specific helper hook (when available)
  const scoreChartsEnabled = useScoreChartsFlag();

  return <div>{scoreChartsEnabled && <ClientScoreCharts />}</div>;
}
```

## Adding New Feature Flags

1. Create the flag in PostHog dashboard
2. For frequently used flags, add helper functions:

```typescript
// In src/featureFlags.ts
export async function isNewFeatureEnabled(): Promise<boolean> {
  return isFeatureEnabled("new-feature-key");
}

// In src/hooks/useFeatureFlag.ts
export function useNewFeatureFlag(): boolean {
  return useFeatureFlag("new-feature-key");
}
```

## Important Notes

- Feature flags are only evaluated for authenticated users
- The server-side implementation uses Clerk authentication to identify users
- The client-side implementation also respects authentication status
- PostHog's feature flags support:
  - Percentage-based rollouts
  - User property targeting
  - A/B testing variants
