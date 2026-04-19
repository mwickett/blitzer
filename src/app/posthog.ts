// app/posthog.js
import { PostHog } from "posthog-node";

// Server-side calls go directly to PostHog (no reverse-proxy through the
// app's own /ingest rewrite — that's a client-side pattern for adblockers
// and loops unreliably on Vercel previews with deployment protection).
const host =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export default function PostHogClient() {
  const posthogClient = new PostHog(
    process.env.NEXT_PUBLIC_POSTHOG_KEY as string,
    {
      host: host,
      flushAt: 1,
      flushInterval: 0,
    }
  );

  // posthogClient.on("error", (error) => {
  //   console.error(error);
  // });

  // posthogClient.debug();
  return posthogClient;
}
