import PostHogClient from "./app/posthog";
import { auth, currentUser } from "@clerk/nextjs/server";

// Every uncached flag check costs two network calls (Clerk currentUser +
// PostHog getAllFlags) and runs on hot paths like the game page, so flag
// sets are cached per user for a short TTL within each server instance.
const FLAG_CACHE_TTL_MS = 60_000;

type FlagSet = Record<string, string | boolean>;

const flagCache = new Map<
  string,
  { flags: Promise<FlagSet>; expiresAt: number }
>();

async function fetchAllFlags(userId: string): Promise<FlagSet> {
  // Fetch person properties so flags targeted by email/username resolve
  // correctly on the server (posthog-node won't hit stored person props
  // unless we pass them, which causes preview/new envs to miss).
  const user = await currentUser();
  const personProperties: Record<string, string> = {};
  const email = user?.primaryEmailAddress?.emailAddress;
  if (email) personProperties.email = email;
  if (user?.username) personProperties.username = user.username;

  const posthog = PostHogClient();
  return posthog.getAllFlags(userId, { personProperties });
}

function getCachedFlags(userId: string): Promise<FlagSet> {
  const now = Date.now();
  const cached = flagCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.flags;
  }

  // Cache the promise immediately so concurrent checks share one fetch;
  // evict on failure so an outage isn't cached for the full TTL.
  const flags = fetchAllFlags(userId).catch((error) => {
    flagCache.delete(userId);
    throw error;
  });
  flagCache.set(userId, { flags, expiresAt: now + FLAG_CACHE_TTL_MS });
  return flags;
}

// Server-side flag checking
export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  const { userId } = await auth();

  // Only check flags for authenticated users
  if (!userId) return false;

  const flags = await getCachedFlags(userId);
  return !!flags[flagKey];
}

// Check if LLM features are enabled
export async function isLlmFeaturesEnabled(): Promise<boolean> {
  return isFeatureEnabled("llm-features");
}
