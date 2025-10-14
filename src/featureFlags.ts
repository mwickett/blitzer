import PostHogClient from "./app/posthog";
import { auth } from "@clerk/nextjs/server";

// Server-side flag checking
export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  const { userId } = await auth();

  // Only check flags for authenticated users
  if (!userId) return false;

  const posthog = PostHogClient();

  if (!posthog || typeof (posthog as any).getAllFlags !== "function") {
    return false;
  }

  const flags = await (posthog as any).getAllFlags(userId);

  return !!flags[flagKey];
}

// For convenience, add a specific function for the score-charts flag
export async function isScoreChartsEnabled(): Promise<boolean> {
  return isFeatureEnabled("score-charts");
}

// Check if LLM features are enabled
export async function isLlmFeaturesEnabled(): Promise<boolean> {
  return isFeatureEnabled("llm-features");
}
export async function isClerkOrgsEnabled(): Promise<boolean> {
  return isFeatureEnabled("use-clerk-organizations");
}
