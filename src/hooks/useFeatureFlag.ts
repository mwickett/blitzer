"use client";

import { usePostHog } from "posthog-js/react";
import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";

export function useFeatureFlag(flagKey: string): boolean {
  const posthog = usePostHog();
  const { isSignedIn } = useAuth();
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    // Only check flags for authenticated users
    if (!isSignedIn || !posthog) return;

    // Get the feature flag value
    const flagValue = posthog.isFeatureEnabled(flagKey);

    if (typeof flagValue === "boolean") {
      setEnabled(flagValue);
    }
  }, [posthog, flagKey, isSignedIn]);

  return enabled;
}

// Convenience hook for the score-charts flag
export function useScoreChartsFlag(): boolean {
  return useFeatureFlag("score-charts");
}

// Convenience hook for the llm-features flag
export function useLlmFeaturesFlag(): boolean {
  return useFeatureFlag("llm-features");
}
