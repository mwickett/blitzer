// app/posthog.js
import { PostHog } from "posthog-node";

const host = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/ingest`
  : `http://localhost:3000/ingest`;

export default function PostHogClient() {
  const posthogClient = new PostHog(
    process.env.NEXT_PUBLIC_POSTHOG_KEY as string,
    {
      host: host,
      flushAt: 1,
      flushInterval: 0,
    }
  );

  posthogClient.on("error", (error) => {
    console.error(error);
  });

  posthogClient.debug();
  return posthogClient;
}
