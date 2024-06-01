// app/posthog.js
import { PostHog } from "posthog-node";

export default function PostHogClient() {
  const posthogClient = new PostHog(
    process.env.NEXT_PUBLIC_POSTHOG_KEY as string,
    {
      host: "/ingest",
      flushAt: 1,
      flushInterval: 0,
    }
  );
  return posthogClient;
}
