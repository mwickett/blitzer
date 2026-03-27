import PostHogClient from "./app/posthog";
import { auth } from "@clerk/nextjs/server";

// Server-side flag checking
export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  const { userId } = await auth();

  // Only check flags for authenticated users
  if (!userId) return false;

  const posthog = PostHogClient();
  const flags = await posthog.getAllFlags(userId);

  return !!flags[flagKey];
}

// Check if LLM features are enabled
export async function isLlmFeaturesEnabled(): Promise<boolean> {
  return isFeatureEnabled("llm-features");
}
