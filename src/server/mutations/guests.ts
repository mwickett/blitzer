"use server";

import prisma from "@/server/db/db";
import { getAuthenticatedUserPrismaId } from "./common";

// Create a guest user
export async function createGuestUser(name: string) {
  const {
    userId: clerkUserId,
    id,
    posthog,
  } = await getAuthenticatedUserPrismaId();

  const guestUser = await prisma.guestUser.create({
    data: {
      name,
      createdById: id,
    },
  });

  posthog.capture({
    distinctId: clerkUserId,
    event: "create_guest_user",
    properties: { guestId: guestUser.id, guestName: name },
  });

  return guestUser;
}

// Get guest users created by the current user
export async function getMyGuestUsers() {
  const { id } = await getAuthenticatedUserPrismaId();

  const guestUsers = await prisma.guestUser.findMany({
    where: { createdById: id },
    orderBy: { createdAt: "desc" },
  });

  return guestUsers;
}

// Send invitation to a guest user
export async function inviteGuestUser(guestId: string, email: string) {
  const {
    userId: clerkUserId,
    id,
    posthog,
  } = await getAuthenticatedUserPrismaId();

  // Check if user owns this guest
  const guestUser = await prisma.guestUser.findUnique({
    where: { id: guestId },
    select: { createdById: true, name: true },
  });

  if (!guestUser) throw new Error("Guest user not found");
  if (guestUser.createdById !== id)
    throw new Error("Unauthorized - not the creator of this guest");

  // Update guest with invitation details
  await prisma.guestUser.update({
    where: { id: guestId },
    data: {
      invitationSent: true,
      invitationSentAt: new Date(),
      emailSent: email,
    },
  });

  // TODO: Implement email sending for guest invitation
  // For now, record the event in PostHog
  posthog.capture({
    distinctId: clerkUserId,
    event: "invite_guest_user",
    properties: {
      guestId,
      email,
      guestName: guestUser.name,
    },
  });

  return { success: true };
}
