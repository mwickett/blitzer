"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";
import legacyFriends from "@/data/legacy-friends.json";

const friendMap = legacyFriends as Record<
  string,
  { username: string; email: string }[]
>;

/**
 * Invite a previous Blitzer friend to the active circle.
 * Validates the email is in the caller's legacy friend allowlist.
 */
export async function inviteFriendToCircle(email: string) {
  const { userId, orgId } = await auth();
  const posthog = posthogClient();

  if (!userId) throw new Error("Unauthorized");
  if (!orgId) throw new Error("No active circle");

  // Validate email is in the caller's legacy friend list
  const userFriends = friendMap[userId];
  if (!userFriends || !userFriends.some((f) => f.email === email)) {
    return { success: false, error: "Not in your friends list" };
  }

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
  } catch (error: unknown) {
    // Clerk throws an error for duplicate invitations — treat as success
    const isDuplicate =
      error &&
      typeof error === "object" &&
      "errors" in error &&
      Array.isArray((error as { errors: { code: string }[] }).errors) &&
      (error as { errors: { code: string }[] }).errors.some(
        (e) =>
          e.code === "duplicate_record" ||
          e.code === "already_a_member_in_organization"
      );

    if (isDuplicate) {
      return { success: true };
    }

    console.error("Failed to invite friend to circle:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send invitation",
    };
  }
}
