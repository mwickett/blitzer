"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { sanitizeAnalyticsUrl } from "@/lib/analytics";

export default function PostHogPageView() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const posthog = usePostHog();
  const { user } = useUser();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const profileId = user?.id;
  const email = user?.primaryEmailAddress?.emailAddress;
  const username = user?.username;
  const identifiedUser = useRef<string | null>(null);
  const lastPageView = useRef<string | null>(null);
  const lastFlagTraits = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !posthog || isSignedIn === undefined) return;
    if (isSignedIn) {
      if (!userId || profileId !== userId) return;
      // These traits are evaluation overrides, not persisted analytics events.
      const identityChanged = posthog.get_distinct_id() !== userId;
      const traits = JSON.stringify([userId, email, username]);
      if (lastFlagTraits.current !== traits) {
        // identify reloads flags for a new identity. A hydrated existing
        // identity needs an explicit reload when its targeting traits change.
        posthog.setPersonPropertiesForFlags({ email, username }, !identityChanged);
        lastFlagTraits.current = traits;
      }
      if (identityChanged) posthog.identify(userId);
      identifiedUser.current = userId;
    } else if (identifiedUser.current || posthog.get_property("$user_id")) {
      posthog.reset();
      identifiedUser.current = null;
      lastFlagTraits.current = null;
    }

    // Identity must be synchronized before the first pageview of a login,
    // account switch, or sign-out. Profile refreshes don't add pageviews.
    const view = JSON.stringify([isSignedIn ? userId : null, pathname, search]);
    if (pathname && lastPageView.current !== view) {
      posthog.capture("$pageview", {
        $current_url: sanitizeAnalyticsUrl(window.origin + pathname),
      });
      lastPageView.current = view;
    }
  }, [isLoaded, isSignedIn, userId, profileId, email, username, pathname, search, posthog]);

  return null;
}
