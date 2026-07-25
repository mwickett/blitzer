import { auth } from "@clerk/nextjs/server";
import CreateCircleBanner from "@/components/CreateCircleBanner";

/**
 * The dashboard is reachable without an active Circle now that pickup games
 * exist, so this is the invitation into Circles that the old redirect to
 * /circles/setup used to be.
 */
export default async function CircleCtaSection() {
  const { orgId } = await auth();
  if (orgId) return null;
  return <CreateCircleBanner />;
}
