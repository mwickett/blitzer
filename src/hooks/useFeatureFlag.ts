"use client";

import { useFeatureFlagEnabled } from "posthog-js/react";
import { useAuth } from "@clerk/nextjs";

export function useFeatureFlag(flagKey: string): boolean {
  const { isSignedIn } = useAuth();
  const enabled = useFeatureFlagEnabled(flagKey);

  return isSignedIn ? enabled === true : false;
}

// Convenience hook for the llm-features flag
export function useLlmFeaturesFlag(): boolean {
  return useFeatureFlag("llm-features");
}
