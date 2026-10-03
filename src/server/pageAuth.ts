import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Page-level sign-in check. Signed-out document requests are sent to sign-in
 * and returned afterwards; other signed-out requests get Clerk's 404.
 */
export async function requireSignedIn() {
  return auth.protect();
}

/**
 * For pages that only make sense inside an active Circle. Pickup players can
 * be signed in without one, so they are sent to Circle setup instead.
 */
export async function requireCircle() {
  const session = await auth.protect();
  if (!session.orgId) redirect("/circles/setup");
  return session as typeof session & { orgId: string };
}
