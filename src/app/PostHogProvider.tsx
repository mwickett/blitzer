"use client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { sanitizeAnalyticsEvent, sanitizeAnalyticsUrl } from "@/lib/analytics";

if (typeof window !== "undefined") {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    debug: process.env.NODE_ENV === "development",
    before_send: sanitizeAnalyticsEvent,
    // Initial-origin properties also travel in flag requests, which do not
    // pass through before_send. Keep sanitized pageviews instead of collecting
    // automatic campaign/referrer attribution containing invitation links.
    save_campaign_params: false,
    save_referrer: false,
    loaded: (client) => {
      for (const key of ["$initial_person_info", "$initial_referrer_info", "$initial_campaign_params"]) {
        client.unregister(key);
      }
    },
    session_recording: {
      maskCapturedNetworkRequestFn: (request) => ({ ...request, name: sanitizeAnalyticsUrl(request.name) }),
    },
  });
}
export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
