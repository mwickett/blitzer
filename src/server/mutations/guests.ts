"use server";

import { captureServerEvent } from "@/server/telemetry";

import prisma from "@/server/db/db";
import { requireAuthContext } from "./common";
import { sendGuestInvitationEmail } from "@/server/email";

// Create a guest user
export async function createGuestUser(name: string) {
  const { user, posthog, orgId, prismaUserId } = await requireAuthContext(
    "orgWithPrismaId"
  );

  const guestUser = await prisma.guestUser.create({
    data: {
      name,
      createdById: prismaUserId,
      organizationId: orgId,
    },
  });

  captureServerEvent(posthog, {
    distinctId: user.userId,
    event: "create_guest_user",
    properties: { guestId: guestUser.id, organizationId: orgId },
  });

  return guestUser;
}

// Get guest users in the active circle
export async function getCircleGuestUsers() {
  const { orgId } = await requireAuthContext("org");

  const guestUsers = await prisma.guestUser.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });

  return guestUsers;
}

// Send invitation to a guest user
export async function inviteGuestUser(guestId: string, email: string) {
  const {
    userId: clerkUserId,
    prismaUserId,
    posthog,
  } = await requireAuthContext("prismaId");

  // Check if user owns this guest
  const guestUser = await prisma.guestUser.findUnique({
    where: { id: guestId },
    select: {
      createdById: true,
      name: true,
      createdBy: {
        select: {
          username: true,
        },
      },
    },
  });

  if (!guestUser) throw new Error("Guest user not found");
  if (guestUser.createdById !== prismaUserId)
    throw new Error("Unauthorized - not the creator of this guest");

  const emailResult = await sendGuestInvitationEmail({
    email,
    guestName: guestUser.name,
    inviterUsername: guestUser.createdBy.username,
    guestId,
    userId: clerkUserId,
  });

  if (!emailResult.success) {
    return {
      success: false,
      error: emailResult.error ?? "Failed to send invitation",
    };
  }

  await prisma.guestUser.update({
    where: { id: guestId },
    data: {
      invitationSent: true,
      invitationSentAt: new Date(),
      emailSent: email,
    },
  });

  captureServerEvent(posthog, {
    distinctId: clerkUserId,
    event: "invite_guest_user",
    properties: {
      guestId,
    },
  });

  return { success: true };
}
