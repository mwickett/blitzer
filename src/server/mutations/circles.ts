"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";

/**
 * Invite a user to the active circle by email.
 * Used during the friend migration step of circle setup.
 */
export async function inviteFriendToCircle(email: string) {
  const { userId, orgId } = await auth();
  const posthog = posthogClient();

  if (!userId) throw new Error("Unauthorized");
  if (!orgId) throw new Error("No active circle");

  try {
    const client = await clerkClient();
    await client.organizations.createOrganizationInvitation({
      organizationId: orgId,
      emailAddress: email,
      role: "org:member",
      inviterUserId: userId,
    });

    posthog.capture({
      distinctId: userId,
      event: "invite_friend_to_circle",
      properties: { organizationId: orgId },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to invite friend to circle:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send invitation",
    };
  }
}
