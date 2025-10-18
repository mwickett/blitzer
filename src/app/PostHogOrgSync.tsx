"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import posthog from "posthog-js";

export default function PostHogOrgSync() {
  const { orgId } = useAuth();

  useEffect(() => {
    if (orgId) {
      // Associate this session with the active org group
      try {
        posthog.group("organization", orgId);
        posthog.register({ organizationId: orgId });
      } catch (e) {
        // no-op if posthog not initialized on client
      }
    }
  }, [orgId]);

  return null;
}
