// app/providers.js
"use client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

if (typeof window !== "undefined") {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    person_profiles: "always", // or 'always' to create profiles for anonymous users as well
    capture_pageview: false,
    capture_pageleave: true,
  });
}
export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
