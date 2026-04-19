import PostHogClient from "./app/posthog";
import { auth, currentUser } from "@clerk/nextjs/server";

// Server-side flag checking
export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  const { userId } = await auth();

  // Only check flags for authenticated users
  if (!userId) return false;

  // Fetch person properties so flags targeted by email/username resolve
  // correctly on the server (posthog-node won't hit stored person props
  // unless we pass them, which causes preview/new envs to miss).
  const user = await currentUser();
  const personProperties: Record<string, string> = {};
  const email = user?.primaryEmailAddress?.emailAddress;
  if (email) personProperties.email = email;
  if (user?.username) personProperties.username = user.username;

  const posthog = PostHogClient();
  const flags = await posthog.getAllFlags(userId, { personProperties });

  return !!flags[flagKey];
}

// Check if LLM features are enabled
export async function isLlmFeaturesEnabled(): Promise<boolean> {
  return isFeatureEnabled("llm-features");
}
