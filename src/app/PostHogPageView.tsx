// app/PostHogPageView.jsx
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

import { useAuth, useUser } from "@clerk/nextjs";

export default function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  const { user } = useUser();
  const { isSignedIn, userId } = useAuth();

  // Track pageviews
  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthog.capture("$pageview", {
        $current_url: url,
      });
    }
  }, [pathname, searchParams, posthog]);

  // Identify users in PostHog
  useEffect(() => {
    if (isSignedIn && userId && user && !posthog._isIdentified()) {
      posthog.identify(userId, {
        email: user.primaryEmailAddress?.emailAddress,
        username: user.username,
      });
    }

    if (!isSignedIn && posthog._isIdentified()) {
      posthog.reset();
    }
  }, [posthog, user]);

  return null;
}
