import { after } from "next/server";
import type { PostHog } from "posthog-node";

/** Delivery belongs to Next's background task, never the score transaction. */
export function captureServerEvent(
  client: Pick<PostHog, "captureImmediate">,
  event: Parameters<PostHog["captureImmediate"]>[0],
) {
  try {
    after(async () => {
      try {
        await client.captureImmediate(event);
      } catch {
        console.warn("Analytics delivery failed", { event: event.event });
      }
    });
  } catch {
    // No supported request lifetime (for example during offline tooling).
    // Analytics must not turn an already committed operation into a failure.
    console.warn("Analytics background task unavailable", { event: event.event });
  }
}
